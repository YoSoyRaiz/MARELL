'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { safeError } from '@/lib/errors'
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
  currency?: 'DOP' | 'USD'
  /** APR percent, optional. */
  interestRateApr?: number | null
  /** Day of month 1-31 for credit card statement close. */
  cycleCloseDay?: number | null
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
  const roundedBalance = Math.round(balance * 100) / 100

  // Insertamos la cuenta con balance=0. Si hay balance inicial ≠ 0,
  // creamos después una txn 'Saldo inicial' — el trigger
  // transactions_balance_sync actualiza accounts.balance al monto
  // correcto. Esto permite que la serie histórica de Net Worth muestre
  // la cuenta apareciendo en su fecha de creación en vez de
  // proyectarse hacia el pasado (que es lo que pasaba antes con balance
  // hardcoded sin txn correspondiente).
  const insertRow = {
    budget_id: budget.id,
    name: input.name.trim(),
    type: input.type,
    currency: input.currency ?? 'DOP',
    balance: 0,
    is_budget_account: !isTracking,
    sort_order: nextSort,
    note: input.note?.trim() || null,
    interest_rate_apr:
      input.interestRateApr != null
        ? Math.round(input.interestRateApr * 100) / 100
        : null,
    cycle_close_day:
      input.cycleCloseDay != null ? Math.trunc(input.cycleCloseDay) : null,
  }

  const { data: newAccount, error } = await supabase
    .from('accounts')
    .insert(insertRow)
    .select('id')
    .single()

  if (error || !newAccount) return { error: safeError(error, 'cuentas') }

  // Opening balance txn — solo si el balance inicial es ≠ 0. La
  // marcamos con payee_name='Saldo inicial' + category_id=null para
  // que los reportes de flujo (Income/Expense, Trends, Age of Money)
  // la excluyan via el filtro SYSTEM_PAYEES. Sí cuenta para Net Worth
  // porque mueve el balance real de la cuenta. Approved+reconciled
  // para que no aparezca como pending en la lista.
  if (Math.abs(roundedBalance) >= 0.005) {
    // Fecha DR-aware: el servidor de Vercel corre UTC pero el usuario
    // espera ver "hoy" en DR (UTC-4).
    const now = new Date()
    const drNow = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    const todayDR = `${drNow.getUTCFullYear()}-${String(drNow.getUTCMonth() + 1).padStart(2, '0')}-${String(drNow.getUTCDate()).padStart(2, '0')}`

    const { error: openErr } = await supabase.from('transactions').insert({
      budget_id: budget.id,
      account_id: newAccount.id,
      date: todayDR,
      payee_name: 'Saldo inicial',
      category_id: null,
      amount: roundedBalance,
      cleared: 'reconciled' as const,
      approved: true,
    })
    if (openErr) {
      // Best-effort cleanup si la txn falla: borramos la cuenta para
      // no dejarla en estado inconsistente (cuenta sin balance esperado).
      await supabase.from('accounts').delete().eq('id', newAccount.id)
      return { error: safeError(openErr, 'cuentas') }
    }
  }

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

  const updates = {
    name: input.name.trim(),
    type: input.type,
    currency: input.currency ?? 'DOP',
    balance: Math.round(balance * 100) / 100,
    is_budget_account: !isTracking,
    note: input.note?.trim() || null,
    interest_rate_apr:
      input.interestRateApr != null
        ? Math.round(input.interestRateApr * 100) / 100
        : null,
    cycle_close_day:
      input.cycleCloseDay != null ? Math.trunc(input.cycleCloseDay) : null,
  }

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', input.id)

  if (error) return { error: safeError(error, 'cuentas') }

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
  if (error) return { error: safeError(error, 'cuentas') }

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
  if (error) return { error: safeError(error, 'cuentas') }

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

/**
 * Lista preview de transacciones que se van a "bloquear" (cleared →
 * reconciled) cuando el usuario confirme el reconcile. Ordenadas por
 * fecha descendente y limitadas — solo necesitamos mostrar lo
 * suficiente para que el usuario reconozca lo que está aprobando.
 */
export interface PendingReconcileTxn {
  id: string
  date: string
  payeeName: string
  amount: number
  cleared: 'uncleared' | 'cleared'
}

export async function fetchPendingReconcileTxns(
  accountId: string,
): Promise<{ error?: string; txns?: PendingReconcileTxn[]; total?: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id')
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

  // Devolvemos hasta 50 — más que eso satura la UI y el usuario
  // típicamente solo necesita reconocer las últimas. El conteo total
  // se devuelve aparte para mostrar 'y X más'.
  const { data, error, count } = await supabase
    .from('transactions')
    .select('id, date, payee_name, amount, cleared', { count: 'exact' })
    .eq('account_id', accountId)
    .neq('cleared', 'reconciled')
    .order('date', { ascending: false })
    .limit(50)
  if (error) return { error: safeError(error, 'cuentas') }

  return {
    txns: (data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      payeeName: r.payee_name ?? '',
      amount: Number(r.amount),
      cleared: r.cleared as 'uncleared' | 'cleared',
    })),
    total: count ?? data?.length ?? 0,
  }
}

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
      cleared: 'reconciled' as const,
      category_id: null,
    })
    if (insertErr) return { error: safeError(insertErr, 'cuentas') }
  }

  // 2. Lock all non-reconciled transactions in this account.
  const { data: locked, error: lockErr } = await supabase
    .from('transactions')
    .update({ cleared: 'reconciled' as const })
    .eq('account_id', accountId)
    .neq('cleared', 'reconciled')
    .select('id')
  if (lockErr) return { error: safeError(lockErr, 'cuentas') }

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
  if (error) return { error: safeError(error, 'cuentas') }
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
    .update({ cleared: status })
    .eq('id', transactionId)
  if (error) return { error: safeError(error, 'cuentas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Auto-generated monthly interest ─────────────────────────────
//
// Para cuentas de deuda con APR > 0, MARELL puede generar una txn
// estimada de intereses cada mes. La cifra es una aproximación
// (balance × APR / 12) que el usuario puede editar si su banco
// calcula distinto. La implementación vive en src/lib/interest.ts
// porque también la usa el cron mensual.

export interface GenerateInterestResult {
  error?: string
  generated?: number
  skipped?: number
  details?: { accountName: string; status: 'generated' | 'skipped'; reason?: string; amount?: number }[]
}

/**
 * Acción manual disparada desde la UI (botón en Cuentas o en el
 * reporte de Salud de deudas). Sin parámetro = mes pasado.
 */
export async function generateMonthlyInterest(
  monthYYYYMM?: string,
): Promise<GenerateInterestResult> {
  const { generateInterestForBudget, previousMonthDR } = await import('@/lib/interest')

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

  const month = monthYYYYMM ?? previousMonthDR()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: 'Mes inválido' }

  // Cast: SupabaseClient<Database> es estructuralmente compatible con
  // SupabaseClient genérico que pide el helper.
  const result = await generateInterestForBudget(
    supabase as unknown as Parameters<typeof generateInterestForBudget>[0],
    budget.id as string,
    month,
  )
  revalidatePath('/app', 'layout')
  return result
}

// Helper exposed for the client component
export { accountCategoryFromType }
