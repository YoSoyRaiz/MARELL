'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type Currency = 'DOP' | 'USD'

export async function updateProfile(input: { displayName: string }) {
  const name = input.displayName.trim()
  if (!name) return { error: 'Nombre requerido' }
  if (name.length > 80) return { error: 'Nombre demasiado largo (máx. 80)' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function updateBudgetSettings(input: {
  budgetId: string
  name: string
  currency: Currency
  usdToDopRate: number
}) {
  const name = input.name.trim()
  if (!input.budgetId) return { error: 'Presupuesto requerido' }
  if (!name) return { error: 'Nombre del presupuesto requerido' }
  if (name.length > 80) return { error: 'Nombre demasiado largo (máx. 80)' }
  if (input.currency !== 'DOP' && input.currency !== 'USD') {
    return { error: 'Moneda inválida' }
  }
  // Sanity check the rate — enough latitude to handle DOP volatility but
  // catch obvious typos like "6" or "600".
  if (
    !Number.isFinite(input.usdToDopRate) ||
    input.usdToDopRate < 10 ||
    input.usdToDopRate > 500
  ) {
    return { error: 'Tasa USD↔DOP fuera de rango' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', input.budgetId)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('budgets')
    .update({
      name,
      currency: input.currency,
      usd_to_dop_rate: Math.round(input.usdToDopRate * 10000) / 10000,
    } as never)
    .eq('id', input.budgetId)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function setEmailNotifications(enabled: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({
      email_notifications: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// Permanently deletes the user's account: cascades through their budget
// data + profile, then removes the auth.users row via the security-definer
// `public.delete_my_account` RPC. After this returns the session is no
// longer valid; sign out and redirect to /login regardless.
/**
 * Bumps `notifications_last_seen` to now. Called whenever the user
 * opens the in-app bell so the unread dot disappears across sessions.
 */
export async function markNotificationsSeen() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ notifications_last_seen: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }
  return { success: true as const }
}

// ── Data export ─────────────────────────────────────────────────
//
// Right to portability: the user can pull every byte of their MARELL
// data at any moment. JSON for full backup, CSV for spreadsheet-friendly
// transaction export.

export interface ExportResult {
  error?: string
  filename?: string
  /** UTF-8 string the client turns into a Blob for download. */
  payload?: string
  mimeType?: 'application/json' | 'text/csv'
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Full JSON backup: everything the user owns under their first budget
 * (categories, accounts, txns, splits, assignments, scheduled, payees).
 * Suitable for re-importing into a future tool or just as a paranoia
 * snapshot.
 */
export async function exportBudgetJSON(): Promise<ExportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { error: 'Sin presupuesto' }

  const [
    groupsRes,
    catsRes,
    accountsRes,
    txnsRes,
    subsRes,
    assignsRes,
    scheduledRes,
    payeesRes,
  ] = await Promise.all([
    supabase.from('category_groups').select('*').eq('budget_id', budget.id),
    supabase.from('categories').select('*').eq('budget_id', budget.id),
    supabase.from('accounts').select('*').eq('budget_id', budget.id),
    supabase.from('transactions').select('*').eq('budget_id', budget.id),
    supabase
      .from('subtransactions')
      .select('*, transactions!inner(budget_id)')
      .eq('transactions.budget_id', budget.id),
    supabase.from('monthly_assignments').select('*').eq('budget_id', budget.id),
    supabase.from('scheduled_transactions').select('*').eq('budget_id', budget.id),
    supabase.from('payees').select('*').eq('budget_id', budget.id),
  ])

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    budget,
    category_groups: groupsRes.data ?? [],
    categories: catsRes.data ?? [],
    accounts: accountsRes.data ?? [],
    transactions: txnsRes.data ?? [],
    subtransactions: subsRes.data ?? [],
    monthly_assignments: assignsRes.data ?? [],
    scheduled_transactions: scheduledRes.data ?? [],
    payees: payeesRes.data ?? [],
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return {
    filename: `marell-backup-${stamp}.json`,
    payload: JSON.stringify(payload, null, 2),
    mimeType: 'application/json',
  }
}

/**
 * CSV export of every transaction (with split children flattened into
 * one row per category contribution). Columns chosen to be friendly for
 * Excel/Numbers/Google Sheets without further transformation.
 */
export async function exportTransactionsCSV(): Promise<ExportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { error: 'Sin presupuesto' }

  const [accountsRes, catsRes, txnsRes, subsRes] = await Promise.all([
    supabase.from('accounts').select('id, name').eq('budget_id', budget.id),
    supabase.from('categories').select('id, name').eq('budget_id', budget.id),
    supabase
      .from('transactions')
      .select(
        'id, date, payee_name, account_id, category_id, amount, memo, cleared, is_split, transfer_account_id',
      )
      .eq('budget_id', budget.id)
      .order('date', { ascending: true }),
    supabase
      .from('subtransactions')
      .select('id, transaction_id, category_id, amount, memo, transactions!inner(budget_id)')
      .eq('transactions.budget_id', budget.id),
  ])

  const accountById = new Map(
    (accountsRes.data ?? []).map((a) => [a.id as string, a.name as string]),
  )
  const categoryById = new Map(
    (catsRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  )
  const subsByParent = new Map<
    string,
    Array<{ category_id: string | null; amount: number; memo: string | null }>
  >()
  for (const s of subsRes.data ?? []) {
    const pid = s.transaction_id as string
    const arr = subsByParent.get(pid) ?? []
    arr.push({
      category_id: (s.category_id as string | null) ?? null,
      amount: Number(s.amount),
      memo: (s.memo as string | null) ?? null,
    })
    subsByParent.set(pid, arr)
  }

  const headers = [
    'fecha',
    'pagado_a',
    'cuenta',
    'categoria',
    'monto',
    'memo',
    'estado',
    'es_transferencia',
    'es_split',
    'split_padre_id',
  ]
  const rows: string[][] = []

  for (const t of txnsRes.data ?? []) {
    const accountName = accountById.get(t.account_id as string) ?? ''
    const isTransfer = t.transfer_account_id !== null && t.transfer_account_id !== undefined
    if (t.is_split) {
      const children = subsByParent.get(t.id as string) ?? []
      for (const c of children) {
        rows.push([
          t.date as string,
          (t.payee_name as string | null) ?? '',
          accountName,
          c.category_id ? (categoryById.get(c.category_id) ?? '') : '',
          String(c.amount),
          c.memo ?? (t.memo as string | null) ?? '',
          (t.cleared as string | null) ?? 'uncleared',
          isTransfer ? 'sí' : 'no',
          'sí',
          t.id as string,
        ])
      }
    } else {
      rows.push([
        t.date as string,
        (t.payee_name as string | null) ?? '',
        accountName,
        t.category_id
          ? (categoryById.get(t.category_id as string) ?? '')
          : '',
        String(t.amount),
        (t.memo as string | null) ?? '',
        (t.cleared as string | null) ?? 'uncleared',
        isTransfer ? 'sí' : 'no',
        'no',
        '',
      ])
    }
  }

  // Excel-friendly: BOM + CRLF line endings keep Spanish accents intact
  // when the file is opened in Excel on macOS or Windows.
  const csv =
    '﻿' +
    [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')

  const stamp = new Date().toISOString().slice(0, 10)
  return {
    filename: `marell-transacciones-${stamp}.csv`,
    payload: csv,
    mimeType: 'text/csv',
  }
}

export async function deleteMyAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const userId = user.id

  const { error } = await supabase.rpc('delete_my_account')
  if (error) {
    console.error('[deleteMyAccount] rpc failed', error)
    return { error: 'No pudimos eliminar la cuenta. Contacta a soporte.' }
  }

  // Invalida el JWT en TODOS los dispositivos (admin global signOut),
  // no solo el actual. Antes solo se llamaba supabase.auth.signOut()
  // del lado del browser, que invalida la cookie local pero el JWT
  // seguía siendo válido hasta su expiración natural en otros devices.
  // (Auditoría 2026-05-24, B6.)
  try {
    const admin = createAdminClient()
    await admin.auth.admin.signOut(userId, 'global')
  } catch (e) {
    // Best-effort — si falla, el JWT local ya queda invalidado abajo
    // y eventualmente expira en otros devices. Solo loggeamos.
    console.warn('[deleteMyAccount] global signOut failed', e)
  }

  await supabase.auth.signOut()
  redirect('/login')
}
