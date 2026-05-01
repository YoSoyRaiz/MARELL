'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type TransactionType = 'income' | 'expense'

// ── Credit-card auto-bucket ─────────────────────────────────────
//
// YNAB pattern: when you charge a credit card, the budget category gets
// debited AND the "card payment" category gets credited by the same
// amount, so available net stays the same and you build up the money to
// pay the card. The reverse happens on a refund.
//
// MARELL implements this by looking up a single category named
// "Pago tarjeta de crédito" (created during onboarding when the user has
// any credit card) for the budget. We bump its monthly_assignment up by
// abs(charge) on each CC charge and down on each refund. Multi-card
// budgets share one bucket; per-card buckets would need a column on
// `accounts.payment_category_id` (not added yet).
//
// If the category doesn't exist (legacy budgets created before this hook,
// or user deleted it), the helper silently no-ops — the rest of the
// transaction flow keeps working.

const CC_PAYMENT_CATEGORY_NAME = 'Pago tarjeta de crédito'

function monthFromDate(iso: string): string {
  return iso.slice(0, 7)
}

async function findCreditCardPaymentCategoryId(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('budget_id', budgetId)
    .ilike('name', CC_PAYMENT_CATEGORY_NAME)
    .maybeSingle()
  return data ? (data.id as string) : null
}

/**
 * Apply `delta` (signed) to the credit-card payment category's assignment
 * for the given month. Used to reverse old contributions and apply new
 * ones whenever a CC-account transaction is created, updated, or deleted.
 *
 * Skips silently when there's no payment category in the budget or when
 * the category being charged IS the payment category itself (don't
 * double-bucket internal payments).
 */
async function applyCcBucketDelta(
  supabase: SupabaseClient,
  budgetId: string,
  month: string,
  delta: number,
  excludeCategoryId: string | null = null,
) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) return
  const paymentCatId = await findCreditCardPaymentCategoryId(supabase, budgetId)
  if (!paymentCatId) return
  if (excludeCategoryId && excludeCategoryId === paymentCatId) return

  const { data: existing } = await supabase
    .from('monthly_assignments')
    .select('assigned')
    .eq('budget_id', budgetId)
    .eq('category_id', paymentCatId)
    .eq('month', month)
    .maybeSingle()
  const previous = Number(existing?.assigned ?? 0)
  const next = Math.round((previous + delta) * 100) / 100
  await supabase.from('monthly_assignments').upsert(
    {
      budget_id: budgetId,
      category_id: paymentCatId,
      month,
      assigned: next,
    },
    { onConflict: 'category_id,month' },
  )
}

/**
 * For a credit-card-account transaction, returns the signed delta to
 * apply to the CC payment bucket. The bucket moves opposite to the
 * transaction sign so a -500 charge bumps the bucket by +500 (more to
 * pay) and a +200 refund knocks it down by 200.
 *
 * For splits, walks each subtransaction so the bucket math reflects the
 * actual category spend, not the parent total.
 */
type AutoBucketContribution = {
  amount: number // signed (negative = expense)
  categoryId: string | null
}

function ccBucketDelta(
  contributions: AutoBucketContribution[],
): number {
  // Only categorized contributions move the bucket — uncategorized
  // entries (e.g. a stray inflow with no category) stay neutral so we
  // don't bucket money that hasn't entered the budget yet.
  let delta = 0
  for (const c of contributions) {
    if (!c.categoryId) continue
    delta += -c.amount // bucket grows when we charge (negative amount)
  }
  return Math.round(delta * 100) / 100
}

export interface SplitInput {
  categoryId: string | null
  amount: number // positive (sign comes from parent's `type`)
  memo: string | null
}

export interface CreateTransactionInput {
  accountId: string
  categoryId: string | null
  date: string // YYYY-MM-DD
  payeeName: string
  amount: number // positive number; sign comes from `type`
  memo: string | null
  type: TransactionType
  splits?: SplitInput[] // when present and length > 1, transaction is split
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function isSplit(input: { splits?: SplitInput[] }): boolean {
  return Array.isArray(input.splits) && input.splits.length >= 2
}

// Sum of split children must equal parent total (within rounding tolerance).
// Returns null if valid, error string otherwise.
function validateSplits(splits: SplitInput[], total: number): string | null {
  if (splits.length < 2) return 'Un split necesita al menos 2 categorías'
  let sum = 0
  for (const s of splits) {
    if (!Number.isFinite(s.amount) || s.amount <= 0) {
      return 'Cada split debe tener monto positivo'
    }
    sum += s.amount
  }
  if (Math.abs(sum - total) > 0.005) {
    return `La suma de los splits ($${sum.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`
  }
  return null
}

/**
 * Look up the most-recently used category for a given payee name in the
 * current user's first budget. Returns the category id (or null when no
 * categorized history exists). Used by the form to prefill the category
 * field as the user types a payee.
 */
export async function suggestCategoryForPayee(
  payeeName: string,
): Promise<{ categoryId: string | null }> {
  const trimmed = payeeName.trim()
  if (trimmed.length < 2) return { categoryId: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { categoryId: null }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { categoryId: null }

  // Pull the last few categorized transactions matching this payee and
  // pick whichever category appears most often. Most-frequent beats
  // most-recent because YNAB-style budgets get noisy edits.
  const { data } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('budget_id', budget.id)
    .ilike('payee_name', trimmed)
    .not('category_id', 'is', null)
    .eq('is_split', false)
    .order('date', { ascending: false })
    .limit(20)

  if (!data || data.length === 0) return { categoryId: null }

  const counts = new Map<string, number>()
  for (const row of data) {
    const id = row.category_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  return { categoryId: best }
}

export async function createTransaction(input: CreateTransactionInput) {
  if (!input.accountId) return { error: 'Cuenta requerida' }
  if (!isValidDate(input.date)) return { error: 'Fecha inválida' }
  if (!input.payeeName.trim()) return { error: 'Pagado a requerido' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify the account belongs to the user (via budget ownership)
  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id, balance')
    .eq('id', input.accountId)
    .single()
  if (!account) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', account.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const split = isSplit(input)

  if (split) {
    const err = validateSplits(input.splits!, input.amount)
    if (err) return { error: err }
    // Verify each split's category (when set) belongs to budget.
    for (const s of input.splits!) {
      if (!s.categoryId) continue
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('id', s.categoryId)
        .eq('budget_id', budget.id)
        .single()
      if (!cat) return { error: 'Categoría inválida en un split' }
    }
  } else if (input.categoryId) {
    // Single-category txn — verify the category belongs to the budget.
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const sign = input.type === 'income' ? 1 : -1
  const signedAmount = sign * Math.abs(input.amount)

  const { data: parent, error: insertErr } = await supabase
    .from('transactions')
    .insert({
      account_id: input.accountId,
      budget_id: budget.id,
      date: input.date,
      payee_name: input.payeeName.trim(),
      // Splits never carry a category on the parent — the children do.
      category_id: split ? null : input.categoryId,
      memo: input.memo?.trim() || null,
      amount: signedAmount,
      cleared: 'uncleared',
      approved: true,
      is_split: split,
    })
    .select('id')
    .single()
  if (insertErr || !parent) return { error: insertErr?.message ?? 'Error al crear' }

  if (split) {
    const subRows = input.splits!.map((s) => ({
      transaction_id: parent.id as string,
      category_id: s.categoryId,
      memo: s.memo?.trim() || null,
      amount: sign * Math.abs(s.amount),
    }))
    const { error: subErr } = await supabase.from('subtransactions').insert(subRows)
    if (subErr) {
      // Best-effort rollback of parent row to keep data consistent.
      await supabase.from('transactions').delete().eq('id', parent.id as string)
      return { error: subErr.message }
    }
  }

  // Update the account's running balance (uses parent total only).
  const newBalance = Math.round((Number(account.balance) + signedAmount) * 100) / 100
  const { error: updateErr } = await supabase
    .from('accounts')
    .update({ balance: newBalance })
    .eq('id', input.accountId)
  if (updateErr) return { error: updateErr.message }

  // Credit-card auto-bucket: when this charge lands on a credit_card
  // account, move the same amount into the payment category for the
  // transaction's month. Splits propagate per-child.
  const { data: accountWithType } = await supabase
    .from('accounts')
    .select('type')
    .eq('id', input.accountId)
    .single()
  if (accountWithType?.type === 'credit_card') {
    const contributions: AutoBucketContribution[] = split
      ? input.splits!.map((s) => ({
          amount: sign * Math.abs(s.amount),
          categoryId: s.categoryId,
        }))
      : [{ amount: signedAmount, categoryId: input.categoryId }]
    const delta = ccBucketDelta(contributions)
    if (Math.abs(delta) >= 0.005) {
      await applyCcBucketDelta(
        supabase,
        budget.id as string,
        monthFromDate(input.date),
        delta,
        split ? null : input.categoryId,
      )
    }
  }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string
}

export async function updateTransaction(input: UpdateTransactionInput) {
  if (!input.id) return { error: 'ID requerido' }
  if (!input.accountId) return { error: 'Cuenta requerida' }
  if (!isValidDate(input.date)) return { error: 'Fecha inválida' }
  if (!input.payeeName.trim()) return { error: 'Pagado a requerido' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Fetch the existing transaction (to know how to roll back the balance
  // and reverse the old credit-card auto-bucket contribution).
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, account_id, amount, budget_id, category_id, is_split, date')
    .eq('id', input.id)
    .single()
  if (!existing) return { error: 'Transacción no encontrada' }

  // Verify ownership through the budget.
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  // The new account must belong to the same budget.
  const { data: newAccount } = await supabase
    .from('accounts')
    .select('id, budget_id, balance, type')
    .eq('id', input.accountId)
    .single()
  if (!newAccount || newAccount.budget_id !== existing.budget_id) {
    return { error: 'Cuenta inválida' }
  }

  // Capture the old account's type so we know whether to reverse the old
  // CC bucket contribution. Same lookup if the account hasn't changed.
  let oldAccountType: string | null = newAccount.type as string
  if (existing.account_id !== input.accountId) {
    const { data: oldAcc } = await supabase
      .from('accounts')
      .select('type')
      .eq('id', existing.account_id)
      .single()
    oldAccountType = oldAcc ? (oldAcc.type as string) : null
  }

  // Pre-fetch old subtransactions before they get rebuilt below — needed
  // to compute the old CC bucket contribution accurately.
  const { data: oldSubsRows } = existing.is_split
    ? await supabase
        .from('subtransactions')
        .select('category_id, amount')
        .eq('transaction_id', input.id)
    : { data: null as Array<{ category_id: string | null; amount: number }> | null }

  const split = isSplit(input)
  if (split) {
    const err = validateSplits(input.splits!, input.amount)
    if (err) return { error: err }
    for (const s of input.splits!) {
      if (!s.categoryId) continue
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('id', s.categoryId)
        .eq('budget_id', budget.id)
        .single()
      if (!cat) return { error: 'Categoría inválida en un split' }
    }
  } else if (input.categoryId) {
    // Optional category must belong to the budget.
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const sign = input.type === 'income' ? 1 : -1
  const oldSignedAmount = Number(existing.amount)
  const newSignedAmount = sign * Math.abs(input.amount)

  const accountChanged = existing.account_id !== input.accountId

  // Update the transaction row first; if it fails, no balance changes happen.
  const { error: updateErr } = await supabase
    .from('transactions')
    .update({
      account_id: input.accountId,
      // Splits never carry a category on the parent.
      category_id: split ? null : input.categoryId,
      date: input.date,
      payee_name: input.payeeName.trim(),
      memo: input.memo?.trim() || null,
      amount: newSignedAmount,
      is_split: split,
    })
    .eq('id', input.id)
  if (updateErr) return { error: updateErr.message }

  // Rebuild subtransactions: simplest correct approach is delete-then-insert.
  await supabase.from('subtransactions').delete().eq('transaction_id', input.id)
  if (split) {
    const subRows = input.splits!.map((s) => ({
      transaction_id: input.id,
      category_id: s.categoryId,
      memo: s.memo?.trim() || null,
      amount: sign * Math.abs(s.amount),
    }))
    const { error: subErr } = await supabase.from('subtransactions').insert(subRows)
    if (subErr) return { error: subErr.message }
  }

  if (accountChanged) {
    // Roll back the original account.
    const { data: oldAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', existing.account_id)
      .single()
    if (oldAccount) {
      const rolledBack =
        Math.round((Number(oldAccount.balance) - oldSignedAmount) * 100) / 100
      await supabase
        .from('accounts')
        .update({ balance: rolledBack })
        .eq('id', existing.account_id)
    }
    // Apply the new amount to the new account.
    const applied = Math.round((Number(newAccount.balance) + newSignedAmount) * 100) / 100
    await supabase
      .from('accounts')
      .update({ balance: applied })
      .eq('id', input.accountId)
  } else {
    // Same account: just apply the net delta.
    const delta = newSignedAmount - oldSignedAmount
    const applied = Math.round((Number(newAccount.balance) + delta) * 100) / 100
    await supabase
      .from('accounts')
      .update({ balance: applied })
      .eq('id', input.accountId)
  }

  // Credit-card auto-bucket sync: reverse the old contribution at its
  // old month, then apply the new contribution at the new month. Months
  // can differ when the user changes the txn date across a boundary.
  const budgetIdStr = budget.id as string
  if (oldAccountType === 'credit_card') {
    const oldContribs: AutoBucketContribution[] =
      existing.is_split && oldSubsRows
        ? oldSubsRows.map((r) => ({
            amount: Number(r.amount),
            categoryId: r.category_id,
          }))
        : [
            {
              amount: oldSignedAmount,
              categoryId: (existing.category_id as string | null) ?? null,
            },
          ]
    const oldDelta = ccBucketDelta(oldContribs)
    if (Math.abs(oldDelta) >= 0.005) {
      await applyCcBucketDelta(
        supabase,
        budgetIdStr,
        monthFromDate(existing.date as string),
        -oldDelta,
        existing.is_split ? null : ((existing.category_id as string | null) ?? null),
      )
    }
  }
  if (newAccount.type === 'credit_card') {
    const newContribs: AutoBucketContribution[] = split
      ? input.splits!.map((s) => ({
          amount: sign * Math.abs(s.amount),
          categoryId: s.categoryId,
        }))
      : [{ amount: newSignedAmount, categoryId: input.categoryId }]
    const newDelta = ccBucketDelta(newContribs)
    if (Math.abs(newDelta) >= 0.005) {
      await applyCcBucketDelta(
        supabase,
        budgetIdStr,
        monthFromDate(input.date),
        newDelta,
        split ? null : input.categoryId,
      )
    }
  }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export interface BulkTransactionRow {
  date: string
  payeeName: string
  amount: number // already signed (+ income, − expense)
  memo: string | null
}

export interface BulkCreateInput {
  accountId: string
  categoryId: string | null
  transactions: BulkTransactionRow[]
}

export async function bulkCreateTransactions(input: BulkCreateInput) {
  if (!input.accountId) return { error: 'Cuenta requerida' }
  if (!input.transactions || input.transactions.length === 0) {
    return { error: 'Sin transacciones que importar' }
  }
  if (input.transactions.length > 1000) {
    return { error: 'Máximo 1,000 transacciones por importación' }
  }

  // Validate each row
  for (const t of input.transactions) {
    if (!isValidDate(t.date)) return { error: `Fecha inválida en una fila: ${t.date}` }
    if (!t.payeeName.trim()) return { error: 'Hay filas sin descripción' }
    if (!Number.isFinite(t.amount) || Math.abs(t.amount) < 0.005) {
      return { error: 'Hay filas con monto inválido o cero' }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id, balance')
    .eq('id', input.accountId)
    .single()
  if (!account) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', account.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const inserts = input.transactions.map((t) => ({
    account_id: input.accountId,
    budget_id: budget.id,
    date: t.date,
    payee_name: t.payeeName.trim(),
    category_id: input.categoryId,
    memo: t.memo?.trim() || null,
    amount: Math.round(t.amount * 100) / 100,
    cleared: 'uncleared' as const,
    approved: true,
  }))

  const { error: insertErr } = await supabase.from('transactions').insert(inserts)
  if (insertErr) return { error: insertErr.message }

  // Sum amounts and update balance once
  const totalDelta =
    Math.round(inserts.reduce((s, t) => s + t.amount, 0) * 100) / 100
  const newBalance = Math.round((Number(account.balance) + totalDelta) * 100) / 100
  const { error: updateErr } = await supabase
    .from('accounts')
    .update({ balance: newBalance })
    .eq('id', input.accountId)
  if (updateErr) return { error: updateErr.message }

  revalidatePath('/app', 'layout')
  return { success: true as const, imported: inserts.length }
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Get the transaction (with account info) to roll back the balance.
  // Pull transfer_transaction_id too so we can delete the twin if it's a
  // transfer pair, and category_id/is_split/date so we can reverse the
  // CC bucket contribution.
  const { data: txn } = await supabase
    .from('transactions')
    .select(
      'id, account_id, amount, budget_id, transfer_transaction_id, category_id, is_split, date',
    )
    .eq('id', transactionId)
    .single()
  if (!txn) return { error: 'Transacción no encontrada' }

  // Snapshot subtransactions for split bucket reversal before the
  // cascade delete wipes them.
  const { data: subSnap } = txn.is_split
    ? await supabase
        .from('subtransactions')
        .select('category_id, amount')
        .eq('transaction_id', transactionId)
    : { data: null as Array<{ category_id: string | null; amount: number }> | null }

  // Snapshot the account type for CC reversal.
  const { data: accSnap } = await supabase
    .from('accounts')
    .select('type')
    .eq('id', txn.account_id as string)
    .single()

  // Verify ownership
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', txn.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  // Collect all rows to delete (this txn + its transfer twin if any) so we
  // can roll back both account balances in one pass.
  const ids: string[] = [transactionId]
  type Twin = { id: string; account_id: string; amount: number }
  const balanceUpdates: Twin[] = [
    { id: txn.id as string, account_id: txn.account_id as string, amount: Number(txn.amount) },
  ]

  if (txn.transfer_transaction_id) {
    const { data: twin } = await supabase
      .from('transactions')
      .select('id, account_id, amount')
      .eq('id', txn.transfer_transaction_id as string)
      .single()
    if (twin) {
      ids.push(twin.id as string)
      balanceUpdates.push({
        id: twin.id as string,
        account_id: twin.account_id as string,
        amount: Number(twin.amount),
      })
    }
  }

  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids)
  if (delErr) return { error: delErr.message }

  // Roll back balances. Read each account just-in-time so successive
  // updates against the same account compose correctly.
  for (const u of balanceUpdates) {
    const { data: account } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', u.account_id)
      .single()
    if (!account) continue
    const newBalance =
      Math.round((Number(account.balance) - u.amount) * 100) / 100
    await supabase
      .from('accounts')
      .update({ balance: newBalance })
      .eq('id', u.account_id)
  }

  // Reverse the CC bucket contribution if this was a credit-card charge.
  if (accSnap?.type === 'credit_card') {
    const contribs: AutoBucketContribution[] =
      txn.is_split && subSnap
        ? subSnap.map((r) => ({
            amount: Number(r.amount),
            categoryId: r.category_id,
          }))
        : [
            {
              amount: Number(txn.amount),
              categoryId: (txn.category_id as string | null) ?? null,
            },
          ]
    const delta = ccBucketDelta(contribs)
    if (Math.abs(delta) >= 0.005) {
      await applyCcBucketDelta(
        supabase,
        budget.id as string,
        monthFromDate(txn.date as string),
        -delta,
        txn.is_split ? null : ((txn.category_id as string | null) ?? null),
      )
    }
  }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Transfers ───────────────────────────────────────────────────
//
// A transfer is two linked transactions (one per account) that point to each
// other via transfer_transaction_id and to the other account via
// transfer_account_id. The amount on the source row is negative; the dest
// row is positive. Categories don't apply (transfers don't affect the budget
// — money just moves between accounts).

export interface CreateTransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number // positive
  date: string // YYYY-MM-DD
  memo: string | null
}

export async function createTransfer(input: CreateTransferInput) {
  if (!input.fromAccountId) return { error: 'Cuenta origen requerida' }
  if (!input.toAccountId) return { error: 'Cuenta destino requerida' }
  if (input.fromAccountId === input.toAccountId) {
    return { error: 'Las cuentas deben ser diferentes' }
  }
  if (!isValidDate(input.date)) return { error: 'Fecha inválida' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Both accounts must belong to the same budget owned by the user.
  const { data: accts } = await supabase
    .from('accounts')
    .select('id, name, budget_id, balance')
    .in('id', [input.fromAccountId, input.toAccountId])
  if (!accts || accts.length !== 2) return { error: 'Cuenta no encontrada' }

  const fromAcct = accts.find((a) => a.id === input.fromAccountId)
  const toAcct = accts.find((a) => a.id === input.toAccountId)
  if (!fromAcct || !toAcct) return { error: 'Cuenta no encontrada' }
  if (fromAcct.budget_id !== toAcct.budget_id) {
    return { error: 'Las cuentas pertenecen a presupuestos distintos' }
  }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', fromAcct.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const amount = Math.round(input.amount * 100) / 100
  const memo = input.memo?.trim() || null

  // Insert the source row first so we have its id for the destination's
  // transfer_transaction_id.
  const { data: srcRow, error: srcErr } = await supabase
    .from('transactions')
    .insert({
      account_id: fromAcct.id,
      budget_id: budget.id,
      date: input.date,
      payee_name: `Transferencia a ${toAcct.name}`,
      category_id: null,
      memo,
      amount: -amount,
      cleared: 'uncleared',
      approved: true,
      transfer_account_id: toAcct.id,
    })
    .select('id')
    .single()
  if (srcErr || !srcRow) return { error: srcErr?.message ?? 'Error al crear' }

  const { data: dstRow, error: dstErr } = await supabase
    .from('transactions')
    .insert({
      account_id: toAcct.id,
      budget_id: budget.id,
      date: input.date,
      payee_name: `Transferencia desde ${fromAcct.name}`,
      category_id: null,
      memo,
      amount,
      cleared: 'uncleared',
      approved: true,
      transfer_account_id: fromAcct.id,
      transfer_transaction_id: srcRow.id,
    })
    .select('id')
    .single()
  if (dstErr || !dstRow) {
    // Best-effort rollback of the source row.
    await supabase.from('transactions').delete().eq('id', srcRow.id)
    return { error: dstErr?.message ?? 'Error al crear destino' }
  }

  // Link the source back to the destination now that we know its id.
  await supabase
    .from('transactions')
    .update({ transfer_transaction_id: dstRow.id })
    .eq('id', srcRow.id)

  // Update both account balances.
  const newFromBalance =
    Math.round((Number(fromAcct.balance) - amount) * 100) / 100
  const newToBalance =
    Math.round((Number(toAcct.balance) + amount) * 100) / 100
  await supabase.from('accounts').update({ balance: newFromBalance }).eq('id', fromAcct.id)
  await supabase.from('accounts').update({ balance: newToBalance }).eq('id', toAcct.id)

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export interface UpdateTransferInput extends CreateTransferInput {
  id: string // either side of the pair
}

/**
 * Edit an existing transfer in place: the user can change accounts,
 * amount, date, or memo and we keep both legs in sync.
 *
 * Strategy: roll back the old amounts on whatever accounts the legs
 * currently sit on, update both rows to point to the new accounts /
 * amounts / date / memo, then apply the new amounts. Names on the
 * `payee_name` field are regenerated to reflect the (possibly new)
 * account names.
 */
export async function updateTransfer(input: UpdateTransferInput) {
  if (!input.id) return { error: 'ID requerido' }
  if (!input.fromAccountId) return { error: 'Cuenta origen requerida' }
  if (!input.toAccountId) return { error: 'Cuenta destino requerida' }
  if (input.fromAccountId === input.toAccountId) {
    return { error: 'Las cuentas deben ser diferentes' }
  }
  if (!isValidDate(input.date)) return { error: 'Fecha inválida' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Pull the seed leg + its twin to capture old state.
  const { data: seed } = await supabase
    .from('transactions')
    .select('id, account_id, amount, budget_id, transfer_transaction_id, transfer_account_id')
    .eq('id', input.id)
    .single()
  if (!seed) return { error: 'Transferencia no encontrada' }
  if (!seed.transfer_transaction_id) {
    return { error: 'Transacción no es una transferencia' }
  }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', seed.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { data: twin } = await supabase
    .from('transactions')
    .select('id, account_id, amount, transfer_account_id')
    .eq('id', seed.transfer_transaction_id as string)
    .single()
  if (!twin) return { error: 'Pareja de transferencia no encontrada' }

  // Determine which leg is source (negative) and which is destination
  // (positive) so we update the correct rows with the new amount sign.
  const seedIsSource = Number(seed.amount) < 0
  const sourceLeg = seedIsSource ? seed : twin
  const destLeg = seedIsSource ? twin : seed

  // The new accounts must belong to the same budget.
  const { data: accts } = await supabase
    .from('accounts')
    .select('id, name, budget_id, balance')
    .in('id', [input.fromAccountId, input.toAccountId])
  if (!accts || accts.length !== 2) return { error: 'Cuenta no encontrada' }
  const fromAcct = accts.find((a) => a.id === input.fromAccountId)
  const toAcct = accts.find((a) => a.id === input.toAccountId)
  if (!fromAcct || !toAcct) return { error: 'Cuenta no encontrada' }
  if (
    fromAcct.budget_id !== seed.budget_id ||
    toAcct.budget_id !== seed.budget_id
  ) {
    return { error: 'Cuenta de otro presupuesto' }
  }

  const newAmount = Math.round(input.amount * 100) / 100
  const memo = input.memo?.trim() || null

  // 1. Roll back the old amounts on the OLD accounts.
  const oldSourceAmount = Number(sourceLeg.amount) // negative
  const oldDestAmount = Number(destLeg.amount) // positive

  const { data: oldSrcAcc } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', sourceLeg.account_id as string)
    .single()
  const { data: oldDstAcc } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', destLeg.account_id as string)
    .single()
  if (oldSrcAcc) {
    const rolled = Math.round((Number(oldSrcAcc.balance) - oldSourceAmount) * 100) / 100
    await supabase
      .from('accounts')
      .update({ balance: rolled })
      .eq('id', sourceLeg.account_id as string)
  }
  if (oldDstAcc) {
    const rolled = Math.round((Number(oldDstAcc.balance) - oldDestAmount) * 100) / 100
    await supabase
      .from('accounts')
      .update({ balance: rolled })
      .eq('id', destLeg.account_id as string)
  }

  // 2. Update both legs in-place with the new accounts/amount/date/memo.
  const { error: srcUpdErr } = await supabase
    .from('transactions')
    .update({
      account_id: fromAcct.id,
      transfer_account_id: toAcct.id,
      amount: -newAmount,
      date: input.date,
      memo,
      payee_name: `Transferencia a ${toAcct.name}`,
    })
    .eq('id', sourceLeg.id as string)
  if (srcUpdErr) return { error: srcUpdErr.message }

  const { error: dstUpdErr } = await supabase
    .from('transactions')
    .update({
      account_id: toAcct.id,
      transfer_account_id: fromAcct.id,
      amount: newAmount,
      date: input.date,
      memo,
      payee_name: `Transferencia desde ${fromAcct.name}`,
    })
    .eq('id', destLeg.id as string)
  if (dstUpdErr) return { error: dstUpdErr.message }

  // 3. Apply the new amounts to the NEW accounts (read fresh balances —
  // they may be the same accounts as before, in which case the numbers
  // already reflect the rollback).
  const { data: freshFrom } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', fromAcct.id)
    .single()
  const { data: freshTo } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', toAcct.id)
    .single()
  if (freshFrom) {
    const applied = Math.round((Number(freshFrom.balance) - newAmount) * 100) / 100
    await supabase.from('accounts').update({ balance: applied }).eq('id', fromAcct.id)
  }
  if (freshTo) {
    const applied = Math.round((Number(freshTo.balance) + newAmount) * 100) / 100
    await supabase.from('accounts').update({ balance: applied }).eq('id', toAcct.id)
  }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}
