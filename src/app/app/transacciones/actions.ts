'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { getOrCreateClearingAccount } from '@/lib/budget/clearing-account'
import { safeError } from '@/lib/errors'
import { MONTH_NAMES_SHORT_LOWER, monthFromDate } from '@/lib/dates'
import { validateSplits } from '@/lib/splits'
import {
  ccBucketDelta,
  type AutoBucketContribution,
} from './ccBucketMath'
import { applyCcBucketDelta } from './cc-bucket-server'

export type TransactionType = 'income' | 'expense'

// When the user saves a transaction without filling "Pagado a" (e.g.
// from the mobile FAB quick-add when the OCR didn't catch the merchant
// name), build a readable fallback from the date so the row isn't
// blank in the list.
function payeeOrFallback(name: string, date: string): string {
  const trimmed = name.trim()
  if (trimmed) return trimmed
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return 'Recibo'
  const [, , mm, dd] = m
  const monthIdx = parseInt(mm, 10) - 1
  const month = MONTH_NAMES_SHORT_LOWER[monthIdx] ?? ''
  return month ? `Recibo del ${parseInt(dd, 10)} ${month}` : 'Recibo'
}

// Credit-card auto-bucket helpers viven en `./cc-bucket-server`. Solo
// las llamamos desde aquí — antes estaban inlined haciendo este
// archivo más grande de lo necesario.

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
  /** Receipt photo metadata. URL is signed for display, path is the
   *  storage key so we can delete on transaction-delete. Both null when
   *  no receipt was attached. */
  receiptUrl?: string | null
  receiptPath?: string | null
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function isSplit(input: { splits?: SplitInput[] }): boolean {
  return Array.isArray(input.splits) && input.splits.length >= 2
}

// validateSplits vive en @/lib/splits — se movió para hacerlo testeable
// sin importar el módulo 'use server' completo.

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

  const { data: budget } = await (async () => {
    const { budgetId: __activeBudgetId } = await getActiveBudgetId(supabase)
    if (!__activeBudgetId) return { data: null }
    return supabase
      .from('budgets')
      .select('id')
      .eq('id', __activeBudgetId)
      .maybeSingle()
  })()
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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }
  const finalPayee = payeeOrFallback(input.payeeName, input.date)

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
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const split = isSplit(input)

  if (split) {
    const err = validateSplits(input.splits!, input.amount)
    if (err) return { error: err }
    // Verifica TODAS las categorías de los splits en UN solo query.
    // Antes era N queries (una por split) — auditoría de calidad M2.
    const splitCatIds = Array.from(
      new Set(
        input.splits!.map((s) => s.categoryId).filter((id): id is string => !!id),
      ),
    )
    if (splitCatIds.length > 0) {
      const { data: cats } = await supabase
        .from('categories')
        .select('id')
        .in('id', splitCatIds)
        .eq('budget_id', budget.id)
      if ((cats?.length ?? 0) !== splitCatIds.length) {
        return { error: 'Categoría inválida en un split' }
      }
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
      payee_name: finalPayee,
      // Splits never carry a category on the parent — the children do.
      category_id: split ? null : input.categoryId,
      memo: input.memo?.trim() || null,
      amount: signedAmount,
      receipt_url: input.receiptUrl ?? null,
      receipt_path: input.receiptPath ?? null,
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
      return { error: safeError(subErr, 'transacciones') }
    }
  }

  // Account balance is maintained by the `transactions_balance_sync`
  // trigger (migration 2026_05_04). No manual update needed —
  // re-introducing one here would double-count.

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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Monto inválido' }
  }
  const finalPayee = payeeOrFallback(input.payeeName, input.date)

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
    .maybeSingle()
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
    // Mismo bulk lookup que createTransaction — antes era N+1.
    const splitCatIds = Array.from(
      new Set(
        input.splits!.map((s) => s.categoryId).filter((id): id is string => !!id),
      ),
    )
    if (splitCatIds.length > 0) {
      const { data: cats } = await supabase
        .from('categories')
        .select('id')
        .in('id', splitCatIds)
        .eq('budget_id', budget.id)
      if ((cats?.length ?? 0) !== splitCatIds.length) {
        return { error: 'Categoría inválida en un split' }
      }
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
      payee_name: finalPayee,
      memo: input.memo?.trim() || null,
      amount: newSignedAmount,
      is_split: split,
      receipt_url: input.receiptUrl ?? null,
      receipt_path: input.receiptPath ?? null,
    })
    .eq('id', input.id)
  if (updateErr) return { error: safeError(updateErr, 'transacciones') }

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
    if (subErr) return { error: safeError(subErr, 'transacciones') }
  }

  // Balance side-effects (rolling back the old account, applying to
  // the new one, or net-deltaing the same account) are handled by
  // the `transactions_balance_sync` trigger now. The trigger reads
  // OLD vs NEW on UPDATE so account changes + amount changes both
  // flow through automatically.

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
  /** Optional per-row category. When provided overrides the bulk `categoryId`. */
  categoryId?: string | null
}

export interface BulkCreateInput {
  accountId: string
  /** Default category applied to rows that don't have their own `categoryId`. */
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
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  // Collect every category id referenced (bulk default + per-row) and
  // validate them in a single round trip rather than N + 1 queries.
  const referencedCategoryIds = new Set<string>()
  if (input.categoryId) referencedCategoryIds.add(input.categoryId)
  for (const t of input.transactions) {
    if (t.categoryId) referencedCategoryIds.add(t.categoryId)
  }
  if (referencedCategoryIds.size > 0) {
    const ids = Array.from(referencedCategoryIds)
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .in('id', ids)
      .eq('budget_id', budget.id)
    const validIds = new Set((cats ?? []).map((c) => c.id as string))
    for (const id of ids) {
      if (!validIds.has(id)) return { error: 'Categoría no encontrada' }
    }
  }

  const inserts = input.transactions.map((t) => ({
    account_id: input.accountId,
    budget_id: budget.id,
    date: t.date,
    payee_name: t.payeeName.trim(),
    category_id: t.categoryId ?? input.categoryId,
    memo: t.memo?.trim() || null,
    amount: Math.round(t.amount * 100) / 100,
    cleared: 'uncleared' as const,
    approved: true,
  }))

  const { error: insertErr } = await supabase.from('transactions').insert(inserts)
  if (insertErr) return { error: safeError(insertErr, 'transacciones') }

  // The trigger fires once per inserted row and updates the account
  // balance — no manual sum/update needed.

  revalidatePath('/app', 'layout')
  return { success: true as const, imported: inserts.length }
}

/**
 * Batch sibling of `suggestCategoryForPayee`: looks up the best-matching
 * category for many payees at once, in a single query. Used by the PDF
 * import flow to auto-fill categories on the preview rows based on the
 * user's prior categorization history. Match is case-insensitive on the
 * full payee string (no fuzzy/substring match — that would mis-suggest
 * for short generic words).
 */
export async function suggestCategoriesForPayees(
  payeeNames: string[],
): Promise<{ suggestions: Record<string, string> }> {
  const unique = Array.from(
    new Set(
      payeeNames
        .map((p) => p.trim())
        .filter((p) => p.length >= 2),
    ),
  )
  if (unique.length === 0) return { suggestions: {} }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { suggestions: {} }

  const { data: budget } = await (async () => {
    const { budgetId: __activeBudgetId } = await getActiveBudgetId(supabase)
    if (!__activeBudgetId) return { data: null }
    return supabase
      .from('budgets')
      .select('id')
      .eq('id', __activeBudgetId)
      .maybeSingle()
  })()
  if (!budget) return { suggestions: {} }

  // Pull every categorized historical row whose payee matches any input
  // name (case-insensitive). One query, then we tally per-payee in memory.
  const { data } = await supabase
    .from('transactions')
    .select('payee_name, category_id')
    .eq('budget_id', budget.id)
    .in('payee_name', unique)
    .not('category_id', 'is', null)
    .eq('is_split', false)
    .order('date', { ascending: false })
    .limit(500)

  if (!data || data.length === 0) {
    // Fall back to case-insensitive ilike for payees that weren't found
    // via exact match (older transactions sometimes carry casing variants).
    const suggestions: Record<string, string> = {}
    for (const name of unique) {
      const escaped = name.replace(/[%_]/g, '\\$&')
      const { data: rows } = await supabase
        .from('transactions')
        .select('category_id')
        .eq('budget_id', budget.id)
        .ilike('payee_name', escaped)
        .not('category_id', 'is', null)
        .eq('is_split', false)
        .order('date', { ascending: false })
        .limit(10)
      if (!rows || rows.length === 0) continue
      const counts = new Map<string, number>()
      for (const r of rows) {
        const id = r.category_id as string
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      let best: string | null = null
      let bestCount = 0
      for (const [id, c] of counts) {
        if (c > bestCount) {
          best = id
          bestCount = c
        }
      }
      if (best) suggestions[name] = best
    }
    return { suggestions }
  }

  // Tally most-frequent category per payee.
  const perPayee = new Map<string, Map<string, number>>()
  for (const r of data) {
    const name = (r.payee_name as string | null)?.trim()
    const catId = r.category_id as string | null
    if (!name || !catId) continue
    let inner = perPayee.get(name)
    if (!inner) {
      inner = new Map()
      perPayee.set(name, inner)
    }
    inner.set(catId, (inner.get(catId) ?? 0) + 1)
  }

  const suggestions: Record<string, string> = {}
  for (const [name, counts] of perPayee) {
    let best: string | null = null
    let bestCount = 0
    for (const [id, c] of counts) {
      if (c > bestCount) {
        best = id
        bestCount = c
      }
    }
    if (best) suggestions[name] = best
  }
  return { suggestions }
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
      'id, account_id, amount, budget_id, transfer_transaction_id, category_id, is_split, date, receipt_path',
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
    .maybeSingle()
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
  if (delErr) return { error: safeError(delErr, 'transacciones') }

  // Balance rollbacks happen in the trigger now — both the parent
  // delete and the transfer-twin delete fire `transactions_balance_sync`
  // with TG_OP = 'DELETE' which subtracts the amount from the account.

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

  // Tidy up the receipt attachment so it doesn't linger as orphaned
  // storage. Best-effort — if the storage delete fails (file already
  // gone, network blip) we don't fail the whole operation.
  const receiptPath = (txn as { receipt_path?: string | null }).receipt_path
  if (receiptPath) {
    await supabase.storage.from('receipts').remove([receiptPath])
  }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Bulk operations ─────────────────────────────────────────────

export interface BulkResult {
  error?: string
  succeeded?: number
  skipped?: number
  reasonSummary?: string
}

/**
 * Bulk-recategorize plain (non-split, non-transfer) transactions in
 * one round trip per row. Splits and transfers are skipped — they
 * carry per-child or per-leg semantics that can't be recategorized
 * blindly. CC bucket math is reversed and re-applied for each row so
 * the YNAB-style payment category stays in sync.
 */
export async function bulkUpdateCategory(
  ids: string[],
  newCategoryId: string | null,
): Promise<BulkResult> {
  if (!ids || ids.length === 0) return { error: 'Sin transacciones seleccionadas' }
  if (ids.length > 500) return { error: 'Máximo 500 por lote' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // If a target category is given, validate it + look up its budget.
  let budgetId: string | null = null
  if (newCategoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id, budget_id')
      .eq('id', newCategoryId)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
    const { data: bud } = await supabase
      .from('budgets')
      .select('id')
      .eq('id', cat.budget_id as string)
      .maybeSingle()
    if (!bud) return { error: 'Sin acceso al presupuesto' }
    budgetId = cat.budget_id as string
  }

  const { data: rows } = await supabase
    .from('transactions')
    .select(
      'id, account_id, amount, budget_id, category_id, is_split, transfer_account_id, date',
    )
    .in('id', ids)
  if (!rows) return { error: 'No se pudo leer transacciones' }

  // Pre-fetch involved accounts so we can answer "is this a credit_card?"
  // without an N+1 against the accounts table.
  const accountIds = Array.from(new Set(rows.map((r) => r.account_id as string)))
  const accountTypeById = new Map<string, string>()
  if (accountIds.length > 0) {
    const { data: accs } = await supabase
      .from('accounts')
      .select('id, type')
      .in('id', accountIds)
    for (const a of accs ?? []) {
      accountTypeById.set(a.id as string, a.type as string)
    }
  }

  let succeeded = 0
  let skipped = 0
  for (const t of rows) {
    if (t.is_split || t.transfer_account_id) {
      skipped += 1
      continue
    }
    if (budgetId && t.budget_id !== budgetId) {
      skipped += 1
      continue
    }
    // Sanity: every row must belong to a budget the user owns. We rely on
    // RLS to filter foreign rows out of the SELECT, so any rows that
    // came back are owned.

    const oldCategoryId = (t.category_id as string | null) ?? null
    if (oldCategoryId === newCategoryId) {
      // No-op — count as success.
      succeeded += 1
      continue
    }

    const { error: updErr } = await supabase
      .from('transactions')
      .update({ category_id: newCategoryId })
      .eq('id', t.id as string)
    if (updErr) {
      skipped += 1
      continue
    }

    // CC bucket sync for this row only — the bucket is keyed off the
    // category presence, not the specific category. So adding/removing a
    // category can flip whether the bucket counts this charge.
    const accountType = accountTypeById.get(t.account_id as string) ?? null
    if (accountType === 'credit_card') {
      const month = monthFromDate(t.date as string)
      const signed = Number(t.amount)
      // Reverse old bucket contribution if the OLD category existed.
      if (oldCategoryId !== null) {
        const oldDelta = ccBucketDelta([
          { amount: signed, categoryId: oldCategoryId },
        ])
        if (Math.abs(oldDelta) >= 0.005) {
          await applyCcBucketDelta(supabase, t.budget_id as string, month, -oldDelta, oldCategoryId)
        }
      }
      // Apply new bucket contribution if the NEW category exists.
      if (newCategoryId !== null) {
        const newDelta = ccBucketDelta([
          { amount: signed, categoryId: newCategoryId },
        ])
        if (Math.abs(newDelta) >= 0.005) {
          await applyCcBucketDelta(supabase, t.budget_id as string, month, newDelta, newCategoryId)
        }
      }
    }
    succeeded += 1
  }

  revalidatePath('/app', 'layout')
  return {
    succeeded,
    skipped,
    reasonSummary:
      skipped > 0
        ? 'Se omitieron splits y transferencias — esas categorías se editan una a una.'
        : undefined,
  }
}

/**
 * Bulk-delete plain transactions and transfer pairs. For each row:
 * rolls back the affected account balance(s), reverses any CC bucket
 * contribution, and removes both legs of a transfer pair atomically
 * even if only one leg is in the selection.
 */
export async function bulkDeleteTransactions(ids: string[]): Promise<BulkResult> {
  if (!ids || ids.length === 0) return { error: 'Sin transacciones seleccionadas' }
  if (ids.length > 500) return { error: 'Máximo 500 por lote' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Pull every selected row plus enough context to handle transfers and
  // CC buckets in one go.
  const { data: rows } = await supabase
    .from('transactions')
    .select(
      'id, account_id, amount, budget_id, category_id, is_split, date, transfer_transaction_id',
    )
    .in('id', ids)
  if (!rows) return { error: 'No se pudo leer transacciones' }

  // Expand transfer pairs: if one leg is selected, drag the twin too.
  const targetIds = new Set<string>(rows.map((r) => r.id as string))
  const twinFetchIds: string[] = []
  for (const r of rows) {
    if (r.transfer_transaction_id && !targetIds.has(r.transfer_transaction_id as string)) {
      twinFetchIds.push(r.transfer_transaction_id as string)
    }
  }
  if (twinFetchIds.length > 0) {
    const { data: twins } = await supabase
      .from('transactions')
      .select(
        'id, account_id, amount, budget_id, category_id, is_split, date, transfer_transaction_id',
      )
      .in('id', twinFetchIds)
    for (const t of twins ?? []) {
      rows.push(t)
      targetIds.add(t.id as string)
    }
  }

  // Pre-fetch account types for CC bucket checks.
  const accountIds = Array.from(new Set(rows.map((r) => r.account_id as string)))
  const accountTypeById = new Map<string, string>()
  if (accountIds.length > 0) {
    const { data: accs } = await supabase
      .from('accounts')
      .select('id, type')
      .in('id', accountIds)
    for (const a of accs ?? []) {
      accountTypeById.set(a.id as string, a.type as string)
    }
  }

  // Snapshot subtransactions so we can reverse split CC buckets.
  const splitRowIds = rows.filter((r) => r.is_split).map((r) => r.id as string)
  let subsByParent: Map<
    string,
    Array<{ category_id: string | null; amount: number }>
  > = new Map()
  if (splitRowIds.length > 0) {
    const { data: subs } = await supabase
      .from('subtransactions')
      .select('transaction_id, category_id, amount')
      .in('transaction_id', splitRowIds)
    for (const s of subs ?? []) {
      const arr = subsByParent.get(s.transaction_id as string) ?? []
      arr.push({
        category_id: (s.category_id as string | null) ?? null,
        amount: Number(s.amount),
      })
      subsByParent.set(s.transaction_id as string, arr)
    }
  }

  // Balance rollback: el trigger `transactions_balance_sync` (migration
  // 2026_05_04) resta automáticamente OLD.amount del account.balance en
  // cada DELETE. NO duplicamos ese trabajo manualmente — antes había un
  // loop aquí que leía y actualizaba balances en JS, causando un
  // doble-decrement (la auditoría de seguridad lo flaggeó como crítico:
  // corrupción de data financiera).

  // Reverse CC buckets where applicable.
  for (const r of rows) {
    const accountType = accountTypeById.get(r.account_id as string) ?? null
    if (accountType !== 'credit_card') continue
    const contribs: AutoBucketContribution[] = r.is_split
      ? (subsByParent.get(r.id as string) ?? []).map((s) => ({
          amount: Number(s.amount),
          categoryId: s.category_id,
        }))
      : [
          {
            amount: Number(r.amount),
            categoryId: (r.category_id as string | null) ?? null,
          },
        ]
    const delta = ccBucketDelta(contribs)
    if (Math.abs(delta) >= 0.005) {
      await applyCcBucketDelta(
        supabase,
        r.budget_id as string,
        monthFromDate(r.date as string),
        -delta,
        r.is_split ? null : ((r.category_id as string | null) ?? null),
      )
    }
  }

  // Now actually delete (cascade handles subtransactions).
  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .in('id', Array.from(targetIds))
  if (delErr) return { error: safeError(delErr, 'transacciones') }

  revalidatePath('/app', 'layout')
  const skipped = ids.length - rows.filter((r) => ids.includes(r.id as string)).length
  return {
    succeeded: targetIds.size,
    skipped,
  }
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
  /** Categoría opcional — solo se guarda en la pierna source (la
   *  que tiene amount negativo) para que cuente como actividad de
   *  esa categoría. La pierna destination siempre queda null. Útil
   *  para etiquetar pagos de tarjeta, moves a ahorro, etc. */
  categoryId?: string | null
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
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const amount = Math.round(input.amount * 100) / 100
  const memo = input.memo?.trim() || null

  // Validar que la categoría (si se pasa) pertenezca al mismo budget.
  // Si no valida, fallback a null sin error para no bloquear el guardado.
  let sourceCategoryId: string | null = null
  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id, budget_id')
      .eq('id', input.categoryId)
      .single()
    if (cat && cat.budget_id === budget.id) {
      sourceCategoryId = cat.id as string
    }
  }

  // Insert the source row first so we have its id for the destination's
  // transfer_transaction_id.
  const { data: srcRow, error: srcErr } = await supabase
    .from('transactions')
    .insert({
      account_id: fromAcct.id,
      budget_id: budget.id,
      date: input.date,
      payee_name: `Transferencia a ${toAcct.name}`,
      category_id: sourceCategoryId,
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

  // Both balances are updated by the trigger as each leg's INSERT
  // fires (source.amount = -amount, dest.amount = +amount). No manual
  // update needed.

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
    .maybeSingle()
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

  // Validar categoría opcional contra el mismo budget. Cualquier valor
  // inválido (o no provisto) → null en la pierna source.
  let sourceCategoryId: string | null = null
  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id, budget_id')
      .eq('id', input.categoryId)
      .single()
    if (cat && cat.budget_id === seed.budget_id) {
      sourceCategoryId = cat.id as string
    }
  }

  // Update both legs in-place. The `transactions_balance_sync`
  // trigger handles the four-way balance dance automatically: when
  // an UPDATE changes account_id, it subtracts OLD.amount from the
  // old account and adds NEW.amount to the new one. When only the
  // amount changes, it nets the delta on the same account.
  const { error: srcUpdErr } = await supabase
    .from('transactions')
    .update({
      account_id: fromAcct.id,
      transfer_account_id: toAcct.id,
      amount: -newAmount,
      date: input.date,
      memo,
      payee_name: `Transferencia a ${toAcct.name}`,
      category_id: sourceCategoryId,
    })
    .eq('id', sourceLeg.id as string)
  if (srcUpdErr) return { error: safeError(srcUpdErr, 'transacciones') }

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
  if (dstUpdErr) return { error: safeError(dstUpdErr, 'transacciones') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

/**
 * Marca una transacción importada como "transferencia entre cuentas"
 * apuntando a la Cuenta Puente (clearing). Reusa el modelo existente
 * de MARELL: transactions.transfer_account_id + transfer_transaction_id.
 *
 * Flow:
 *   1. La txn original se preserva (mismo monto, misma cuenta).
 *   2. Se setea transfer_account_id = clearing.id en la original.
 *   3. Se crea una pareja en clearing con monto opuesto.
 *   4. Ambas se vinculan via transfer_transaction_id.
 *
 * Ejemplo: BHD -50K → Clearing +50K (pair). Cuando luego se marca el
 * otro lado (Popular +50K), se crea Clearing -50K. Saldo Clearing = 0.
 *
 * Los reports ya filtran `transfer_account_id IS NULL` para excluir
 * transfers automáticamente — sin cambios en dashboard/analisis.
 */
export async function markTransactionAsTransfer(
  transactionId: string,
): Promise<{ error?: string; success?: true }> {
  if (!transactionId) return { error: 'ID requerido' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Trae la txn + valida acceso (RLS).
  const { data: txn } = await supabase
    .from('transactions')
    .select(
      'id, budget_id, account_id, amount, date, payee_name, transfer_account_id',
    )
    .eq('id', transactionId)
    .maybeSingle()
  if (!txn) return { error: 'Transacción no encontrada' }
  if (txn.transfer_account_id) {
    return { error: 'Esta transacción ya está marcada como transferencia' }
  }

  // 2. Get-or-create cuenta clearing del budget.
  const { data: acct } = await supabase
    .from('accounts')
    .select('currency')
    .eq('id', txn.account_id as string)
    .maybeSingle()
  const currency = (acct?.currency as 'DOP' | 'USD' | undefined) ?? 'DOP'

  const clearing = await getOrCreateClearingAccount(
    supabase,
    txn.budget_id as string,
    currency,
  )
  if ('error' in clearing) return { error: clearing.error }

  // 3. Crear la pareja: monto opuesto en la cuenta clearing.
  const pairAmount = -(txn.amount as number)
  const originalAccountId = txn.account_id as string
  const { data: pair, error: pairErr } = await supabase
    .from('transactions')
    .insert({
      budget_id: txn.budget_id as string,
      account_id: clearing.id,
      date: txn.date as string,
      payee_name: (txn.payee_name as string | null) || 'Transferencia (puente)',
      category_id: null,
      amount: pairAmount,
      memo: null,
      cleared: 'reconciled' as const,
      approved: true,
      transfer_account_id: originalAccountId,
      transfer_transaction_id: transactionId,
    })
    .select('id')
    .single()
  if (pairErr || !pair) return { error: safeError(pairErr, 'transacciones') }

  // 4. Update la original: transfer_account_id apunta a clearing,
  //    transfer_transaction_id apunta a la pareja, categoría null.
  const { error: origErr } = await supabase
    .from('transactions')
    .update({
      category_id: null,
      transfer_account_id: clearing.id,
      transfer_transaction_id: pair.id as string,
    })
    .eq('id', transactionId)
  if (origErr) {
    // Rollback: borra la pareja para no dejar inconsistencia.
    await supabase.from('transactions').delete().eq('id', pair.id as string)
    return { error: safeError(origErr, 'transacciones') }
  }

  revalidatePath('/app', 'layout')
  return { success: true }
}

/**
 * Desmarca una transferencia: borra la pareja en clearing y limpia
 * los flags. Si la txn original tenía categoría antes de marcarse,
 * no la restauramos — el usuario tiene que recategorizar manual.
 */
export async function unmarkTransactionAsTransfer(
  transactionId: string,
): Promise<{ error?: string; success?: true }> {
  if (!transactionId) return { error: 'ID requerido' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: txn } = await supabase
    .from('transactions')
    .select('id, transfer_account_id, transfer_transaction_id')
    .eq('id', transactionId)
    .maybeSingle()
  if (!txn) return { error: 'Transacción no encontrada' }
  if (!txn.transfer_account_id) {
    return { error: 'Esta transacción no es una transferencia' }
  }

  // Borra la pareja si existe
  if (txn.transfer_transaction_id) {
    await supabase
      .from('transactions')
      .delete()
      .eq('id', txn.transfer_transaction_id as string)
  }

  // Limpia flags de la original
  const { error } = await supabase
    .from('transactions')
    .update({
      transfer_account_id: null,
      transfer_transaction_id: null,
    })
    .eq('id', transactionId)
  if (error) return { error: safeError(error, 'transacciones') }

  revalidatePath('/app', 'layout')
  return { success: true }
}
