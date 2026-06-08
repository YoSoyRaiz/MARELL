'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeError } from '@/lib/errors'
import { writeActiveBudgetCookie } from '@/lib/budget/active'
import { getOrCreateClearingAccount } from '@/lib/budget/clearing-account'
import { sendEmail } from '@/lib/email/send'
import { clientInvitationEmail } from '@/lib/email/templates'

// Sanity caps para evitar abuse / errores de UI (auditor pega 10K
// categorías por accidente). El usuario normal va a estar lejos de
// estos límites.
const MAX_GROUPS = 30
const MAX_CATEGORIES_TOTAL = 200
const MAX_TXNS_IMPORTED = 5000
const TXN_INSERT_BATCH = 500

export interface AccountSeed {
  name: string
  type: string // checking | savings | cash | credit_card | etc.
  balance: number
  currency: 'DOP' | 'USD'
  /** Opcional — solo lo setea el modal de importar para vincular las
   *  transacciones a la cuenta correcta. UI manual no lo usa. */
  tempId?: string
}

export interface CategoryGroupSeedInput {
  name: string
  categoryNames: string[]
}

/** Transacción pendiente de inserción al crear el cliente. La cuenta
 *  destino se resuelve por `accountTempId` que vincula con
 *  `AccountSeed.tempId`. La categoría se resuelve por nombre (group +
 *  category); null = "Por categorizar". */
export interface PendingTxn {
  accountTempId: string
  categoryGroupName: string | null
  categoryName: string | null
  date: string
  payeeName: string
  amount: number
  memo: string | null
  /** Si true, la txn se inserta en la cuenta source con
   *  transfer_account_id = clearing.id y se crea una pareja con monto
   *  opuesto en la Cuenta Puente. Las transferencias no llevan
   *  categoría — el server ignora categoryGroupName/categoryName. */
  is_transfer?: boolean
}

export interface CreateClientBudgetInput {
  /** Nombre del cliente (ej. "Ana Pérez"). */
  clientLabel: string
  /** Email del cliente — recibe magic link para reclamar su cuenta. */
  email: string
  /** Moneda base del budget. */
  currency: 'DOP' | 'USD'
  /** Categorías iniciales del cliente, agrupadas. Pueden venir del
   *  modal de importar estado de cuenta o agregadas a mano por el
   *  auditor. Si llega vacío, sembramos un único grupo "Otros > Por
   *  categorizar" como fallback. */
  categoryGroups: CategoryGroupSeedInput[]
  /** Cuentas iniciales — opcional, el auditor puede agregar después. */
  accounts?: AccountSeed[]
  /** Txns a insertar al crear. Vinculan con accounts[].tempId y con
   *  categoryGroups por nombre. El trigger DB recalcula balances. */
  transactions?: PendingTxn[]
}

export interface CreateClientBudgetResult {
  error?: string
  /** ID del budget creado, útil para deep-link redirect. */
  budgetId?: string
}

/**
 * Crea un cliente nuevo con su propio usuario y budget pre-configurado.
 *
 * Flujo:
 *   1. Validaciones básicas
 *   2. Invita al cliente (Supabase auth.admin.inviteUserByEmail) —
 *      genera el user en auth.users + envía magic link
 *   3. Skip onboarding wizard (profile.onboarded = true)
 *   4. Crea el budget con created_by = cliente (no auditor!)
 *   5. Inserta budget_members:
 *        - cliente como 'owner' (es su data, su decisión)
 *        - auditor como 'auditor' (read-only + visible en /familia)
 *   6. Inserta agency_relationships(auditor, cliente, budget, label)
 *   7. Rellena category_groups + categories según businessType
 *   8. Crea las accounts iniciales (con Saldo inicial txns si balance != 0)
 *
 * Idempotencia: si el email ya existe en auth.users, retornamos error
 * legible. El flujo de "merge con cuenta existente" queda para V2.
 */
export async function createClientBudget(
  input: CreateClientBudgetInput,
): Promise<CreateClientBudgetResult> {
  // ── Validaciones ───────────────────────────────────────────
  const label = input.clientLabel.trim()
  const email = input.email.trim().toLowerCase()
  if (!label) return { error: 'Nombre del cliente requerido' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Email inválido' }
  }
  if (!['DOP', 'USD'].includes(input.currency)) {
    return { error: 'Moneda inválida' }
  }

  // Sanitiza categorías: trim, dedupe por grupo, descarta vacíos.
  // Fallback a "Otros > Por categorizar" si el auditor procedió con 0.
  const sanitizedGroups: CategoryGroupSeedInput[] = (input.categoryGroups ?? [])
    .map((g) => ({
      name: g.name.trim(),
      categoryNames: Array.from(
        new Set(
          (g.categoryNames ?? [])
            .map((c) => c.trim())
            .filter((c) => c.length > 0),
        ),
      ),
    }))
    .filter((g) => g.name.length > 0 && g.categoryNames.length > 0)
  const finalGroups: CategoryGroupSeedInput[] =
    sanitizedGroups.length > 0
      ? sanitizedGroups
      : [{ name: 'Otros', categoryNames: ['Por categorizar'] }]
  if (finalGroups.length > MAX_GROUPS) {
    return { error: `Máximo ${MAX_GROUPS} grupos de categorías` }
  }
  const totalCats = finalGroups.reduce(
    (s, g) => s + g.categoryNames.length,
    0,
  )
  if (totalCats > MAX_CATEGORIES_TOTAL) {
    return {
      error: `Máximo ${MAX_CATEGORIES_TOTAL} categorías totales (recibimos ${totalCats})`,
    }
  }

  // Cap de txns importadas. Si llegamos al límite es bug de UI — el
  // modal debería bloquear antes de llegar al server action.
  if ((input.transactions?.length ?? 0) > MAX_TXNS_IMPORTED) {
    return {
      error: `Máximo ${MAX_TXNS_IMPORTED} transacciones importadas por cliente`,
    }
  }

  const supabase = await createClient()
  const {
    data: { user: auditor },
  } = await supabase.auth.getUser()
  if (!auditor) return { error: 'No autenticado' }
  if (auditor.email?.toLowerCase() === email) {
    return { error: 'No puedes crearte como tu propio cliente' }
  }

  const admin = createAdminClient()

  // ── 1. Invitar al cliente (crea user + email branded) ─────
  // generateLink({ type: 'invite' }) crea el user en auth.users SIN
  // enviar el correo default de Supabase; nosotros mandamos el email
  // branded via Resend usando clientInvitationEmail. Match al patrón
  // que usa signup() en (auth)/actions.ts. Si el send falla hacemos
  // rollback del user para que el email quede disponible al reintentar.
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marell.do'
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${APP_URL}/app`,
        data: {
          invited_by_auditor_id: auditor.id,
          client_label: label,
        },
      },
    })
  if (linkErr || !linkData?.user || !linkData?.properties?.action_link) {
    const msg = linkErr?.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return {
        error:
          'Ese email ya tiene una cuenta MARELL. Pídele que te invite desde su sección Familia con rol Auditor.',
      }
    }
    return { error: safeError(linkErr, 'clientes') }
  }
  const clientUserId = linkData.user.id
  const inviteUrl = linkData.properties.action_link

  // Nombre del auditor para el subject del correo ("X te invitó…").
  // Si no hay display_name caemos al email del auditor.
  const { data: auditorProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', auditor.id)
    .maybeSingle()
  const inviterName =
    (auditorProfile?.display_name as string | null)?.trim() ||
    auditor.email ||
    'Tu auditor'

  const inviteTpl = clientInvitationEmail(inviterName, label, inviteUrl)
  const emailSent = await sendEmail({
    to: email,
    subject: inviteTpl.subject,
    html: inviteTpl.html,
    text: inviteTpl.text,
  })
  if (!emailSent) {
    // Rollback: borra el user para que se pueda reintentar sin
    // chocar contra "already registered".
    await admin.auth.admin.deleteUser(clientUserId)
    return {
      error:
        'No pudimos enviar el correo de invitación al cliente. Intenta de nuevo en unos minutos.',
    }
  }

  // ── 2. Marcar profile como onboarded (skip wizard) ─────────
  // Necesitamos esperar a que el trigger handle_new_user haya
  // insertado la row de profiles. En la práctica el trigger corre
  // sincrónicamente en el insert de auth.users, así que ya existe.
  // Hacemos update directo — si fallara, fallback a upsert.
  const { error: profErr } = await admin
    .from('profiles')
    .update({ onboarded: true, display_name: label })
    .eq('id', clientUserId)
  if (profErr) {
    // Best-effort cleanup del user creado
    await admin.auth.admin.deleteUser(clientUserId)
    return { error: 'Error al configurar perfil del cliente' }
  }

  // ── 3. Crear budget con created_by = cliente ───────────────
  const { data: budgetRow, error: bErr } = await admin
    .from('budgets')
    .insert({
      name: label,
      currency: input.currency,
      created_by: clientUserId,
    })
    .select('id')
    .single()
  if (bErr || !budgetRow) {
    await admin.auth.admin.deleteUser(clientUserId)
    return { error: safeError(bErr, 'clientes') }
  }
  const budgetId = budgetRow.id as string

  // ── 4. budget_members: cliente=owner + auditor=auditor ─────
  const { error: memErr } = await admin.from('budget_members').insert([
    { budget_id: budgetId, user_id: clientUserId, role: 'owner' },
    { budget_id: budgetId, user_id: auditor.id, role: 'auditor' },
  ])
  if (memErr) {
    // Rollback parcial: borra el budget (cascade limpia children)
    await admin.from('budgets').delete().eq('id', budgetId)
    await admin.auth.admin.deleteUser(clientUserId)
    return { error: safeError(memErr, 'clientes') }
  }

  // ── 5. agency_relationships ────────────────────────────────
  // Cast a never: la tabla es nueva (migration 2026_05_28) y los
  // types generados todavía no la conocen. Tras regenerar
  // `supabase gen types` el cast deja de ser necesario.
  const { error: arErr } = await admin.from('agency_relationships').insert(
    {
      auditor_user_id: auditor.id,
      client_user_id: clientUserId,
      client_budget_id: budgetId,
      client_label: label,
      status: 'active',
    } as never,
  )
  if (arErr) {
    // No es crítico — la membership ya existe. Pero la query del
    // dashboard de clientes depende de esta fila, así que mejor
    // hacemos rollback completo para evitar estado huérfano.
    await admin.from('budgets').delete().eq('id', budgetId)
    await admin.auth.admin.deleteUser(clientUserId)
    return { error: safeError(arErr, 'clientes') }
  }

  // ── 6. Seed de category_groups + categories ────────────────
  // Retenemos IDs para vincular las txns importadas después. Key
  // usada: `${groupName}::${categoryName}`. Best-effort: si un
  // grupo falla, seguimos con el resto.
  const categoryIdByName = new Map<string, string>()
  for (let i = 0; i < finalGroups.length; i++) {
    const g = finalGroups[i]
    const { data: groupRow, error: gErr } = await admin
      .from('category_groups')
      .insert({
        budget_id: budgetId,
        name: g.name,
        sort_order: i + 1,
      })
      .select('id')
      .single()
    if (gErr || !groupRow) continue
    const groupId = groupRow.id as string
    if (g.categoryNames.length > 0) {
      const catRows = g.categoryNames.map((name, idx) => ({
        budget_id: budgetId,
        group_id: groupId,
        name,
        sort_order: idx + 1,
      }))
      const { data: catData } = await admin
        .from('categories')
        .insert(catRows)
        .select('id, name')
      if (catData) {
        for (const c of catData) {
          categoryIdByName.set(
            `${g.name}::${c.name as string}`,
            c.id as string,
          )
        }
      }
    }
  }

  // ── 7. Accounts iniciales ──────────────────────────────────
  // Retenemos IDs por tempId (si vino del modal de importar) para
  // poder vincular las txns importadas después. Si la cuenta NO
  // tiene tempId (auditor la agregó a mano sin importar), aplicamos
  // el patrón clásico de "Saldo inicial" txn.
  const accountIdByTempId = new Map<string, string>()
  const fileTempIdsWithTxns = new Set(
    (input.transactions ?? []).map((t) => t.accountTempId),
  )

  if (input.accounts && input.accounts.length > 0) {
    const DEBT_TYPES = [
      'credit_card',
      'line_of_credit',
      'mortgage',
      'auto_loan',
      'student_loan',
      'personal_loan',
      'medical_debt',
      'other_debt',
    ]
    const TRACKING_TYPES = ['asset', 'liability']
    for (let i = 0; i < input.accounts.length; i++) {
      const a = input.accounts[i]
      const isDebt = DEBT_TYPES.includes(a.type)
      const isTracking = TRACKING_TYPES.includes(a.type)
      const signedBalance = isDebt ? -Math.abs(a.balance) : a.balance
      const { data: acctRow } = await admin
        .from('accounts')
        .insert({
          budget_id: budgetId,
          name: a.name.trim(),
          type: a.type as never,
          currency: a.currency,
          balance: 0,
          is_budget_account: !isTracking,
          sort_order: i,
        })
        .select('id')
        .single()
      if (!acctRow) continue
      const acctId = acctRow.id as string
      if (a.tempId) accountIdByTempId.set(a.tempId, acctId)

      // "Saldo inicial" solo si la cuenta NO viene del modal de
      // importar O el balance es != 0 sin txns asociadas. Si vienen
      // txns importadas para esta cuenta, dejamos que el trigger
      // recalcule de las txns reales — sino doblaríamos el saldo.
      const hasImportedTxns = !!a.tempId && fileTempIdsWithTxns.has(a.tempId)
      if (!hasImportedTxns && Math.abs(signedBalance) >= 0.005) {
        const todayDR = (() => {
          const now = new Date()
          const dr = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          return `${dr.getUTCFullYear()}-${String(dr.getUTCMonth() + 1).padStart(2, '0')}-${String(dr.getUTCDate()).padStart(2, '0')}`
        })()
        await admin.from('transactions').insert({
          budget_id: budgetId,
          account_id: acctId,
          date: todayDR,
          payee_name: 'Saldo inicial',
          category_id: null,
          amount: Math.round(signedBalance * 100) / 100,
          cleared: 'reconciled' as const,
          approved: true,
        })
      }
    }
  }

  // ── 8. Txns importadas (bulk insert en batches) ───────────
  // Best-effort: si una batch falla, log y seguimos. El budget +
  // cuentas + categorías ya están creados; el auditor puede
  // reimportar desde el dashboard del cliente si fuera necesario.
  //
  // Las transferencias se procesan APARTE — cada una necesita una
  // pareja en la Cuenta Puente (clearing) que se lazy-crea.
  if (input.transactions && input.transactions.length > 0) {
    const validTxns = input.transactions.filter((t) => {
      const acctId = accountIdByTempId.get(t.accountTempId)
      return !!acctId
    })

    const normalTxns = validTxns.filter((t) => !t.is_transfer)
    const transferTxns = validTxns.filter((t) => t.is_transfer)

    let skipped = 0

    // 8a. Bulk insert de txns normales
    for (let start = 0; start < normalTxns.length; start += TXN_INSERT_BATCH) {
      const batch = normalTxns.slice(start, start + TXN_INSERT_BATCH)
      const rows = batch.map((t) => {
        const acctId = accountIdByTempId.get(t.accountTempId)!
        let categoryId: string | null = null
        if (t.categoryGroupName && t.categoryName) {
          categoryId =
            categoryIdByName.get(`${t.categoryGroupName}::${t.categoryName}`) ??
            null
        }
        return {
          budget_id: budgetId,
          account_id: acctId,
          date: t.date,
          payee_name: t.payeeName,
          category_id: categoryId,
          amount: Math.round(t.amount * 100) / 100,
          memo: t.memo,
          cleared: 'cleared' as const,
          approved: true,
        }
      })
      const { error: insErr } = await admin
        .from('transactions')
        .insert(rows)
      if (insErr) {
        skipped += rows.length
        console.error('[createClientBudget txn batch error]', {
          batchStart: start,
          batchSize: rows.length,
          message: insErr.message,
        })
      }
    }

    // 8b. Transferencias — una por una porque cada una necesita su
    // pareja vinculada en la Cuenta Puente.
    if (transferTxns.length > 0) {
      // Lazy-create la Cuenta Puente. Usamos la primera moneda que
      // veamos en las transferencias (los bancos en RD son DOP por
      // default; las USD se manejan caso-a-caso).
      const firstCurrency = (() => {
        for (const t of transferTxns) {
          const acct = input.accounts?.find((a) => a.tempId === t.accountTempId)
          if (acct) return acct.currency
        }
        return input.currency
      })()
      // createClient ya está disponible (await del scope arriba); reuso.
      const clearing = await getOrCreateClearingAccount(
        admin as unknown as SupabaseClient,
        budgetId,
        firstCurrency,
      )
      if ('error' in clearing) {
        console.error(
          '[createClientBudget] no se pudo crear Cuenta Puente:',
          clearing.error,
        )
        skipped += transferTxns.length
      } else {
        for (const t of transferTxns) {
          const acctId = accountIdByTempId.get(t.accountTempId)!
          const amount = Math.round(t.amount * 100) / 100
          // Inserta la pareja en clearing primero (signo opuesto)
          const { data: pair, error: pairErr } = await admin
            .from('transactions')
            .insert({
              budget_id: budgetId,
              account_id: clearing.id,
              date: t.date,
              payee_name: t.payeeName || 'Transferencia (puente)',
              category_id: null,
              amount: -amount,
              memo: null,
              cleared: 'reconciled' as const,
              approved: true,
              transfer_account_id: acctId,
            })
            .select('id')
            .single()
          if (pairErr || !pair) {
            skipped++
            continue
          }
          // Inserta la original linkeada
          const { data: orig, error: origErr } = await admin
            .from('transactions')
            .insert({
              budget_id: budgetId,
              account_id: acctId,
              date: t.date,
              payee_name: t.payeeName,
              category_id: null,
              amount,
              memo: t.memo,
              cleared: 'cleared' as const,
              approved: true,
              transfer_account_id: clearing.id,
              transfer_transaction_id: pair.id as string,
            })
            .select('id')
            .single()
          if (origErr || !orig) {
            // Rollback de la pareja para no dejarla huérfana
            await admin
              .from('transactions')
              .delete()
              .eq('id', pair.id as string)
            skipped++
            continue
          }
          // Linkea la pareja de vuelta a la original
          await admin
            .from('transactions')
            .update({ transfer_transaction_id: orig.id as string })
            .eq('id', pair.id as string)
        }
      }
    }

    if (skipped > 0) {
      console.warn(
        `[createClientBudget] ${skipped}/${validTxns.length} txns no se insertaron`,
      )
    }
  }

  // Auditor switch automático al budget del cliente recién creado —
  // siguiente refresh ve el nuevo cliente en su contexto.
  await writeActiveBudgetCookie(budgetId)

  revalidatePath('/app', 'layout')
  return { budgetId }
}

/**
 * Importa estados de cuenta a un budget que YA existe (uso mensual
 * del auditor o del propio cliente).
 *
 * Diferencia con createClientBudget:
 *   - No crea user ni budget
 *   - Dedup: cuentas y categorías existentes se reusan en vez de
 *     duplicarse (match por nombre + moneda + tipo en cuentas; nombre
 *     en categorías)
 *
 * Auth: cualquier miembro del budget puede importar. Validamos via
 * lectura RLS sobre budget_members (si no eres miembro, no devuelve
 * row y abortamos).
 */
export interface ImportStatementsToBudgetInput {
  budgetId: string
  accounts: {
    tempId: string
    name: string
    type: string
    currency: 'DOP' | 'USD'
    openingBalance: number
  }[]
  categoryGroups: CategoryGroupSeedInput[]
  transactions: PendingTxn[]
}

export interface ImportStatementsResult {
  error?: string
  /** Resumen de lo que efectivamente se creó/reusó. Útil para mostrar
   *  un toast al auditor. */
  summary?: {
    accountsCreated: number
    accountsReused: number
    categoriesCreated: number
    categoriesReused: number
    transactionsInserted: number
    transactionsSkipped: number
  }
}

export async function importStatementsToBudget(
  input: ImportStatementsToBudgetInput,
): Promise<ImportStatementsResult> {
  if (!input.budgetId) return { error: 'budgetId requerido' }

  // Cap antes de tocar la DB.
  const txnsIn = input.transactions ?? []
  if (txnsIn.length > MAX_TXNS_IMPORTED) {
    return {
      error: `Máximo ${MAX_TXNS_IMPORTED} transacciones por importación`,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Membership check via lectura del budget. RLS filtra a miembros.
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', input.budgetId)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso a este presupuesto' }

  const admin = createAdminClient()
  const budgetId = input.budgetId

  // ── Dedup helpers ───────────────────────────────────────────
  // Normalizo trim + lowercase para los matches sin sobreescribir el
  // nombre del usuario (preservamos casing original al crear).
  const norm = (s: string) => s.trim().toLowerCase()

  // ── 1. Accounts ─────────────────────────────────────────────
  const accountIdByTempId = new Map<string, string>()
  let accountsCreated = 0
  let accountsReused = 0

  if (input.accounts.length > 0) {
    // Trae cuentas existentes del budget para matchear.
    const { data: existingAccts } = await admin
      .from('accounts')
      .select('id, name, type, currency')
      .eq('budget_id', budgetId)
    const existing = existingAccts ?? []

    const DEBT_TYPES = [
      'credit_card',
      'line_of_credit',
      'mortgage',
      'auto_loan',
      'student_loan',
      'personal_loan',
      'medical_debt',
      'other_debt',
    ]
    const TRACKING_TYPES = ['asset', 'liability']

    // Asegura que sort_order de cuentas nuevas no choque con las que
    // ya tiene el budget.
    const maxSort = existing.reduce(
      (m, a) =>
        Math.max(m, (a as { sort_order?: number }).sort_order ?? 0),
      0,
    )
    let nextSort = maxSort + 1

    for (const a of input.accounts) {
      const match = existing.find(
        (e) =>
          norm(e.name as string) === norm(a.name) &&
          (e.currency as string) === a.currency &&
          (e.type as string) === a.type,
      )
      if (match) {
        accountIdByTempId.set(a.tempId, match.id as string)
        accountsReused++
        continue
      }

      const isTracking = TRACKING_TYPES.includes(a.type)
      const { data: row } = await admin
        .from('accounts')
        .insert({
          budget_id: budgetId,
          name: a.name.trim(),
          type: a.type as never,
          currency: a.currency,
          balance: 0,
          is_budget_account: !isTracking,
          sort_order: nextSort++,
        })
        .select('id')
        .single()
      if (!row) continue
      accountsCreated++
      accountIdByTempId.set(a.tempId, row.id as string)

      // openingBalance solo se aplica si NO hay txns asociadas (el
      // trigger recalcula del histórico de txns y duplicaría sino).
      const hasTxns = txnsIn.some((t) => t.accountTempId === a.tempId)
      const isDebt = DEBT_TYPES.includes(a.type)
      const signed = isDebt ? -Math.abs(a.openingBalance) : a.openingBalance
      if (!hasTxns && Math.abs(signed) >= 0.005) {
        const todayDR = (() => {
          const now = new Date()
          const dr = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          return `${dr.getUTCFullYear()}-${String(dr.getUTCMonth() + 1).padStart(2, '0')}-${String(dr.getUTCDate()).padStart(2, '0')}`
        })()
        await admin.from('transactions').insert({
          budget_id: budgetId,
          account_id: row.id as string,
          date: todayDR,
          payee_name: 'Saldo inicial',
          category_id: null,
          amount: Math.round(signed * 100) / 100,
          cleared: 'reconciled' as const,
          approved: true,
        })
      }
    }
  }

  // ── 2. Category groups + categories ─────────────────────────
  const categoryIdByName = new Map<string, string>()
  let categoriesCreated = 0
  let categoriesReused = 0

  if (input.categoryGroups.length > 0) {
    // Sanitiza igual que createClientBudget.
    const sanitized = input.categoryGroups
      .map((g) => ({
        name: g.name.trim(),
        categoryNames: Array.from(
          new Set(
            g.categoryNames.map((c) => c.trim()).filter(Boolean),
          ),
        ),
      }))
      .filter((g) => g.name && g.categoryNames.length > 0)

    if (sanitized.length > 0) {
      const { data: existingGroups } = await admin
        .from('category_groups')
        .select('id, name')
        .eq('budget_id', budgetId)
      const groupsByNorm = new Map<string, string>()
      for (const g of existingGroups ?? []) {
        groupsByNorm.set(norm(g.name as string), g.id as string)
      }

      // Categorías existentes (todas del budget, agrupadas por groupId).
      const { data: existingCats } = await admin
        .from('categories')
        .select('id, name, group_id')
        .eq('budget_id', budgetId)
      const catsByGroup = new Map<string, Map<string, string>>()
      for (const c of existingCats ?? []) {
        const gid = c.group_id as string
        const m = catsByGroup.get(gid) ?? new Map<string, string>()
        m.set(norm(c.name as string), c.id as string)
        catsByGroup.set(gid, m)
      }

      // Sort order incremental para grupos nuevos.
      const maxGroupSort = (existingGroups ?? []).reduce(
        (m, g) =>
          Math.max(m, (g as { sort_order?: number }).sort_order ?? 0),
        0,
      )
      let nextGroupSort = maxGroupSort + 1

      for (const g of sanitized) {
        let groupId = groupsByNorm.get(norm(g.name))
        if (!groupId) {
          const { data: row } = await admin
            .from('category_groups')
            .insert({
              budget_id: budgetId,
              name: g.name,
              sort_order: nextGroupSort++,
            })
            .select('id')
            .single()
          if (!row) continue
          groupId = row.id as string
          groupsByNorm.set(norm(g.name), groupId)
        }

        const existingInGroup = catsByGroup.get(groupId) ?? new Map<string, string>()
        const newCats: { name: string; sortOrder: number }[] = []
        let nextCatSort = existingInGroup.size + 1
        for (const cname of g.categoryNames) {
          const reusedId = existingInGroup.get(norm(cname))
          if (reusedId) {
            categoryIdByName.set(`${g.name}::${cname}`, reusedId)
            categoriesReused++
            continue
          }
          newCats.push({ name: cname, sortOrder: nextCatSort++ })
        }

        if (newCats.length > 0) {
          const { data: created } = await admin
            .from('categories')
            .insert(
              newCats.map((c) => ({
                budget_id: budgetId,
                group_id: groupId!,
                name: c.name,
                sort_order: c.sortOrder,
              })),
            )
            .select('id, name')
          for (const c of created ?? []) {
            categoryIdByName.set(
              `${g.name}::${c.name as string}`,
              c.id as string,
            )
            categoriesCreated++
          }
        }
      }
    }
  }

  // ── 3. Transactions (bulk batches) ──────────────────────────
  let transactionsInserted = 0
  let transactionsSkipped = 0

  if (txnsIn.length > 0) {
    const validTxns = txnsIn.filter((t) => {
      const acctId = accountIdByTempId.get(t.accountTempId)
      if (!acctId) {
        transactionsSkipped++
        return false
      }
      return true
    })

    const normalTxns = validTxns.filter((t) => !t.is_transfer)
    const transferTxns = validTxns.filter((t) => t.is_transfer)

    // 3a. Bulk insert de txns normales
    for (let start = 0; start < normalTxns.length; start += TXN_INSERT_BATCH) {
      const batch = normalTxns.slice(start, start + TXN_INSERT_BATCH)
      const rows = batch.map((t) => {
        const acctId = accountIdByTempId.get(t.accountTempId)!
        let categoryId: string | null = null
        if (t.categoryGroupName && t.categoryName) {
          categoryId =
            categoryIdByName.get(
              `${t.categoryGroupName}::${t.categoryName}`,
            ) ?? null
        }
        return {
          budget_id: budgetId,
          account_id: acctId,
          date: t.date,
          payee_name: t.payeeName,
          category_id: categoryId,
          amount: Math.round(t.amount * 100) / 100,
          memo: t.memo,
          cleared: 'cleared' as const,
          approved: true,
        }
      })
      const { error: insErr } = await admin.from('transactions').insert(rows)
      if (insErr) {
        transactionsSkipped += rows.length
        console.error('[importStatementsToBudget batch error]', {
          batchStart: start,
          batchSize: rows.length,
          message: insErr.message,
        })
      } else {
        transactionsInserted += rows.length
      }
    }

    // 3b. Transferencias — una por una con pareja en Cuenta Puente.
    if (transferTxns.length > 0) {
      const firstCurrency = (() => {
        for (const t of transferTxns) {
          const acct = input.accounts.find((a) => a.tempId === t.accountTempId)
          if (acct) return acct.currency
        }
        return 'DOP' as const
      })()
      const clearing = await getOrCreateClearingAccount(
        admin as unknown as SupabaseClient,
        budgetId,
        firstCurrency,
      )
      if ('error' in clearing) {
        console.error(
          '[importStatementsToBudget] no se pudo crear Cuenta Puente:',
          clearing.error,
        )
        transactionsSkipped += transferTxns.length
      } else {
        for (const t of transferTxns) {
          const acctId = accountIdByTempId.get(t.accountTempId)!
          const amount = Math.round(t.amount * 100) / 100
          const { data: pair, error: pairErr } = await admin
            .from('transactions')
            .insert({
              budget_id: budgetId,
              account_id: clearing.id,
              date: t.date,
              payee_name: t.payeeName || 'Transferencia (puente)',
              category_id: null,
              amount: -amount,
              memo: null,
              cleared: 'reconciled' as const,
              approved: true,
              transfer_account_id: acctId,
            })
            .select('id')
            .single()
          if (pairErr || !pair) {
            transactionsSkipped++
            continue
          }
          const { data: orig, error: origErr } = await admin
            .from('transactions')
            .insert({
              budget_id: budgetId,
              account_id: acctId,
              date: t.date,
              payee_name: t.payeeName,
              category_id: null,
              amount,
              memo: t.memo,
              cleared: 'cleared' as const,
              approved: true,
              transfer_account_id: clearing.id,
              transfer_transaction_id: pair.id as string,
            })
            .select('id')
            .single()
          if (origErr || !orig) {
            await admin
              .from('transactions')
              .delete()
              .eq('id', pair.id as string)
            transactionsSkipped++
            continue
          }
          await admin
            .from('transactions')
            .update({ transfer_transaction_id: orig.id as string })
            .eq('id', pair.id as string)
          transactionsInserted += 2
        }
      }
    }
  }

  revalidatePath('/app', 'layout')
  return {
    summary: {
      accountsCreated,
      accountsReused,
      categoriesCreated,
      categoriesReused,
      transactionsInserted,
      transactionsSkipped,
    },
  }
}

/**
 * Termina la relación auditor↔cliente: el auditor pierde acceso
 * al budget del cliente. La relación queda registrada con
 * status='ended' para historial. El cliente conserva su budget
 * y su login intactos.
 *
 * Puede ser llamado por el auditor (desde /app/clientes) o por
 * el cliente (desde /app/familia). RLS permite ambos casos.
 */
export async function endClientRelationship(
  agencyRelationshipId: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!agencyRelationshipId) return { error: 'ID requerido' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Cast a unknown porque agency_relationships es tabla nueva y los
  // types generados no la conocen aún.
  const relRes = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          single: () => Promise<{
            data: {
              id: string
              auditor_user_id: string
              client_user_id: string
              client_budget_id: string
            } | null
          }>
        }
      }
    }
  })
    .from('agency_relationships')
    .select('id, auditor_user_id, client_user_id, client_budget_id')
    .eq('id', agencyRelationshipId)
    .single()
  const rel = relRes.data
  if (!rel) return { error: 'Relación no encontrada' }

  // Solo auditor o cliente pueden cancelar la relación (RLS lo
  // valida igual, pero check explícito da mejor mensaje).
  if (rel.auditor_user_id !== user.id && rel.client_user_id !== user.id) {
    return { error: 'Sin permiso' }
  }

  const admin = createAdminClient()
  await admin
    .from('agency_relationships')
    .update({ status: 'ended' } as never)
    .eq('id', agencyRelationshipId)
  // Borra al auditor de budget_members del cliente — pierde acceso
  // inmediato.
  await admin
    .from('budget_members')
    .delete()
    .eq('budget_id', rel.client_budget_id)
    .eq('user_id', rel.auditor_user_id)

  revalidatePath('/app', 'layout')
  return { success: true }
}
