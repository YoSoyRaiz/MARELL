'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type TransactionType = 'income' | 'expense'

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

  // Fetch the existing transaction (to know how to roll back the balance).
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, account_id, amount, budget_id')
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
    .select('id, budget_id, balance')
    .eq('id', input.accountId)
    .single()
  if (!newAccount || newAccount.budget_id !== existing.budget_id) {
    return { error: 'Cuenta inválida' }
  }

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
  // transfer pair.
  const { data: txn } = await supabase
    .from('transactions')
    .select('id, account_id, amount, budget_id, transfer_transaction_id')
    .eq('id', transactionId)
    .single()
  if (!txn) return { error: 'Transacción no encontrada' }

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
