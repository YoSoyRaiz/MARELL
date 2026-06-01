'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeError } from '@/lib/errors'
import { writeActiveBudgetCookie } from '@/lib/budget/active'

// Presets de categorías por tipo de negocio. Mantenemos cortos —
// el auditor ajusta después. La idea es que la primera vista del
// cliente ya tenga estructura usable, no un wizard de 15 pasos.
const PRESETS: Record<string, { groups: { name: string; categories: string[] }[] }> = {
  servicios: {
    groups: [
      { name: 'Ingresos', categories: ['Honorarios', 'Reembolsos'] },
      { name: 'Operación', categories: ['Renta oficina', 'Servicios', 'Suministros'] },
      { name: 'Personal', categories: ['Nómina', 'Comisiones'] },
      { name: 'Impuestos', categories: ['ITBIS', 'ISR'] },
      { name: 'Otros', categories: ['Imprevistos', 'Gastos personales'] },
    ],
  },
  comercio: {
    groups: [
      { name: 'Ingresos', categories: ['Ventas', 'Otros ingresos'] },
      { name: 'Inventario', categories: ['Compra mercancía', 'Fletes'] },
      { name: 'Operación', categories: ['Renta local', 'Servicios', 'Empaque'] },
      { name: 'Personal', categories: ['Nómina'] },
      { name: 'Impuestos', categories: ['ITBIS', 'ISR'] },
      { name: 'Otros', categories: ['Imprevistos'] },
    ],
  },
  restaurante: {
    groups: [
      { name: 'Ingresos', categories: ['Ventas comida', 'Ventas bebida', 'Delivery'] },
      { name: 'Inventario', categories: ['Insumos', 'Bebidas', 'Empaques'] },
      { name: 'Operación', categories: ['Renta', 'Servicios', 'Mantenimiento'] },
      { name: 'Personal', categories: ['Nómina cocina', 'Nómina salón'] },
      { name: 'Impuestos', categories: ['ITBIS', 'ISR'] },
      { name: 'Otros', categories: ['Imprevistos'] },
    ],
  },
  generico: {
    groups: [
      { name: 'Ingresos', categories: ['Entradas principales'] },
      { name: 'Operación', categories: ['Renta', 'Servicios', 'Suministros'] },
      { name: 'Personal', categories: ['Nómina'] },
      { name: 'Impuestos', categories: ['ITBIS', 'ISR'] },
      { name: 'Otros', categories: ['Imprevistos'] },
    ],
  },
}

export type BusinessType = keyof typeof PRESETS

export interface AccountSeed {
  name: string
  type: string // checking | savings | cash | credit_card | etc.
  balance: number
  currency: 'DOP' | 'USD'
}

export interface CreateClientBudgetInput {
  /** Nombre comercial del cliente (ej. "Restaurante Don Pepe"). */
  clientLabel: string
  /** Email del cliente — recibe magic link para reclamar su cuenta. */
  email: string
  /** Tipo de negocio — determina las categorías iniciales. */
  businessType: BusinessType
  /** Moneda base del budget. */
  currency: 'DOP' | 'USD'
  /** Cuentas iniciales — opcional, el auditor puede agregar después. */
  accounts?: AccountSeed[]
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
  if (!PRESETS[input.businessType]) {
    return { error: 'Tipo de negocio inválido' }
  }
  if (!['DOP', 'USD'].includes(input.currency)) {
    return { error: 'Moneda inválida' }
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

  // ── 1. Invitar al cliente (crea user + envía magic link) ───
  // inviteUserByEmail manda email con link de confirmación; al
  // click el cliente queda autenticado y aterriza en /app.
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.marell.do'
  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${APP_URL}/app`,
      data: {
        invited_by_auditor_id: auditor.id,
        client_label: label,
      },
    },
  )
  if (invErr || !invited?.user) {
    // Diferenciamos "usuario ya existe" para mensaje más útil.
    const msg = invErr?.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('exists')) {
      return {
        error:
          'Ese email ya tiene una cuenta MARELL. Pídele que te invite desde su sección Familia con rol Auditor.',
      }
    }
    return { error: safeError(invErr, 'clientes') }
  }
  const clientUserId = invited.user.id

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
  const preset = PRESETS[input.businessType]
  for (let i = 0; i < preset.groups.length; i++) {
    const g = preset.groups[i]
    const { data: groupRow, error: gErr } = await admin
      .from('category_groups')
      .insert({
        budget_id: budgetId,
        name: g.name,
        sort_order: i + 1,
      })
      .select('id')
      .single()
    if (gErr || !groupRow) continue // best-effort; no rollback
    const groupId = groupRow.id as string
    const catRows = g.categories.map((name, idx) => ({
      budget_id: budgetId,
      group_id: groupId,
      name,
      sort_order: idx + 1,
    }))
    if (catRows.length > 0) {
      await admin.from('categories').insert(catRows)
    }
  }

  // ── 7. Accounts iniciales (con saldos iniciales si != 0) ───
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
      // Insertamos cuenta con balance=0; si balance ≠ 0 luego
      // creamos txn 'Saldo inicial' (igual patrón que createAccount)
      const { data: acctRow } = await admin
        .from('accounts')
        .insert({
          budget_id: budgetId,
          name: a.name.trim(),
          // Cast a never porque AccountType es enum estricto pero el
          // input viene como string desde el form. Validamos en el
          // cliente que sea uno de ACCOUNT_TYPES.
          type: a.type as never,
          currency: a.currency,
          balance: 0,
          is_budget_account: !isTracking,
          sort_order: i,
        })
        .select('id')
        .single()
      if (acctRow && Math.abs(signedBalance) >= 0.005) {
        const todayDR = (() => {
          const now = new Date()
          const dr = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          return `${dr.getUTCFullYear()}-${String(dr.getUTCMonth() + 1).padStart(2, '0')}-${String(dr.getUTCDate()).padStart(2, '0')}`
        })()
        await admin.from('transactions').insert({
          budget_id: budgetId,
          account_id: acctRow.id as string,
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

  // Auditor switch automático al budget del cliente recién creado —
  // siguiente refresh ve el nuevo cliente en su contexto.
  await writeActiveBudgetCookie(budgetId)

  revalidatePath('/app', 'layout')
  return { budgetId }
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
