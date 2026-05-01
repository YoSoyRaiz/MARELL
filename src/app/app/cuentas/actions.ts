'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  isDebtType,
  accountCategoryFromType,
  type AccountType,
} from '@/app/onboarding/wizard/types'

const VALID_TYPES: AccountType[] = [
  'checking',
  'savings',
  'cash',
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
  'asset',
  'liability',
]

export interface AccountInput {
  name: string
  type: AccountType
  balance: number // user-entered absolute value; sign is handled per type
  note: string | null
}

export async function createAccount(input: AccountInput) {
  if (!input.name.trim()) return { error: 'Nombre requerido' }
  if (!VALID_TYPES.includes(input.type)) return { error: 'Tipo inválido' }
  if (!Number.isFinite(input.balance)) return { error: 'Balance inválido' }

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
  if (!budget) return { error: 'Presupuesto no encontrado' }

  const { data: existing } = await supabase
    .from('accounts')
    .select('sort_order')
    .eq('budget_id', budget.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort = existing ? Number(existing.sort_order ?? 0) + 1 : 0
  const isTracking = input.type === 'asset' || input.type === 'liability'
  const isDebt = isDebtType(input.type)
  const balance = isDebt ? -Math.abs(input.balance) : input.balance

  // The Supabase generated types lag behind the schema's CHECK constraint
  // expansion (line_of_credit / *_loan / asset / liability), so we widen the
  // type here. The DB constraint enforces validity at runtime.
  const insertRow = {
    budget_id: budget.id,
    name: input.name.trim(),
    type: input.type as string,
    currency: 'DOP',
    balance: Math.round(balance * 100) / 100,
    is_budget_account: !isTracking,
    sort_order: nextSort,
    note: input.note?.trim() || null,
  } as never

  const { error } = await supabase.from('accounts').insert(insertRow)

  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export interface UpdateAccountInput extends AccountInput {
  id: string
}

export async function updateAccount(input: UpdateAccountInput) {
  if (!input.id) return { error: 'ID requerido' }
  if (!input.name.trim()) return { error: 'Nombre requerido' }
  if (!VALID_TYPES.includes(input.type)) return { error: 'Tipo inválido' }
  if (!Number.isFinite(input.balance)) return { error: 'Balance inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership via budget
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, budget_id')
    .eq('id', input.id)
    .single()
  if (!existing) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const isTracking = input.type === 'asset' || input.type === 'liability'
  const isDebt = isDebtType(input.type)
  const balance = isDebt ? -Math.abs(input.balance) : input.balance

  // Same widening as createAccount — the runtime CHECK constraint enforces
  // validity even when the generated TS types are narrower.
  const updates = {
    name: input.name.trim(),
    type: input.type as string,
    balance: Math.round(balance * 100) / 100,
    is_budget_account: !isTracking,
    note: input.note?.trim() || null,
  } as never

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', input.id)

  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function setAccountClosed(accountId: string, closed: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('accounts')
    .select('id, budget_id')
    .eq('id', accountId)
    .single()
  if (!existing) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('accounts')
    .update({ closed })
    .eq('id', accountId)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function deleteAccount(accountId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('accounts')
    .select('id, budget_id')
    .eq('id', accountId)
    .single()
  if (!existing) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  // Cascade deletes transactions through the FK on transactions.account_id
  const { error } = await supabase.from('accounts').delete().eq('id', accountId)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Reconciliation ──────────────────────────────────────────────

export interface ReconcileResult {
  error?: string
  adjustmentAmount?: number
  reconciledCount?: number
}

/**
 * Reconciles an account against an externally-known balance (e.g. what the
 * bank app says). Three things happen:
 *
 * 1. If the actual balance differs from MARELL's stored balance, create
 *    an uncategorized adjustment transaction dated today for the diff.
 *
 * 2. Every transaction in the account is locked to `reconciled` (YNAB's
 *    "lock the past").
 *
 * 3. The account's `balance` column is set to the new internal balance.
 *
 * For cash-style accounts (checking / savings / cash) `actualBalance`
 * is taken as-is. For credit_card / *_loan / mortgage / *_debt the
 * caller enters what's *owed* as a positive number and we flip the
 * sign internally so the column stays negative for debt.
 */
const CASH_RECONCILE_TYPES = new Set(['checking', 'savings', 'cash'])
const DEBT_RECONCILE_TYPES = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

export async function reconcileAccount(
  accountId: string,
  enteredBalance: number,
): Promise<ReconcileResult> {
  if (!Number.isFinite(enteredBalance)) return { error: 'Balance inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id, balance, type')
    .eq('id', accountId)
    .single()
  if (!account) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', account.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const accountType = account.type as string
  const isCash = CASH_RECONCILE_TYPES.has(accountType)
  const isDebt = DEBT_RECONCILE_TYPES.has(accountType)
  if (!isCash && !isDebt) {
    return { error: 'Esta cuenta no se puede reconciliar.' }
  }

  // For debt accounts the user types the amount owed as a positive
  // number. The internal column stays negative.
  const newInternalBalance = isDebt ? -Math.abs(enteredBalance) : enteredBalance
  const currentBalance = Number(account.balance)
  const diff = Math.round((newInternalBalance - currentBalance) * 100) / 100

  // 1. Adjustment txn if needed.
  if (Math.abs(diff) >= 0.005) {
    // Use today (DR-aware) — server runs UTC on Vercel so we explicitly
    // localize. monthBoundsISO uses the same logic; reusing currentMonthDR
    // shape for date-only here.
    const now = new Date()
    const drNow = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    const today = `${drNow.getUTCFullYear()}-${String(drNow.getUTCMonth() + 1).padStart(2, '0')}-${String(drNow.getUTCDate()).padStart(2, '0')}`

    const { error: insertErr } = await supabase.from('transactions').insert({
      budget_id: budget.id,
      account_id: accountId,
      date: today,
      amount: diff,
      payee_name: 'Ajuste de reconciliación',
      memo: 'Generado automáticamente al reconciliar',
      cleared: 'reconciled',
      category_id: null,
    } as never)
    if (insertErr) return { error: insertErr.message }
  }

  // 2. Lock all non-reconciled transactions in this account.
  const { data: locked, error: lockErr } = await supabase
    .from('transactions')
    .update({ cleared: 'reconciled' } as never)
    .eq('account_id', accountId)
    .neq('cleared', 'reconciled')
    .select('id')
  if (lockErr) return { error: lockErr.message }

  // The adjustment txn we inserted in step 1 already pushed the
  // balance to the right number via the `transactions_balance_sync`
  // trigger. No manual `update accounts.balance` needed.

  revalidatePath('/app', 'layout')
  return {
    adjustmentAmount: diff,
    reconciledCount: locked?.length ?? 0,
  }
}

// ── Unreconcile ────────────────────────────────────────────
//
// Reverses the "lock the past" side-effect of reconciling so the user
// can fix a botched reconciliation. Calls a SECURITY DEFINER RPC
// that flips every reconciled txn back to cleared. Doesn't undo the
// adjustment transaction — if the user wants to remove that they can
// delete it manually now that it's editable again.

export async function unreconcileAccount(accountId: string): Promise<{
  error?: string
  unlocked?: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  type RpcArgs = { p_account_id: string }
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: RpcArgs,
    ) => Promise<{ data: number | null; error: { message: string } | null }>
  }).rpc('unreconcile_account', { p_account_id: accountId })
  if (error) return { error: error.message }
  revalidatePath('/app', 'layout')
  return { unlocked: data ?? 0 }
}

/**
 * Toggle a single transaction's cleared state. Used by the transactions
 * list to mark items as cleared one-by-one before a full reconcile.
 */
export async function setTransactionCleared(
  transactionId: string,
  status: 'uncleared' | 'cleared',
) {
  if (status !== 'uncleared' && status !== 'cleared') {
    return { error: 'Estado inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: txn } = await supabase
    .from('transactions')
    .select('id, budget_id, cleared')
    .eq('id', transactionId)
    .single()
  if (!txn) return { error: 'Transacción no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', txn.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  if (txn.cleared === 'reconciled') {
    return { error: 'No se puede modificar una transacción reconciliada' }
  }

  const { error } = await supabase
    .from('transactions')
    .update({ cleared: status } as never)
    .eq('id', transactionId)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// Helper exposed for the client component
export { accountCategoryFromType }
