'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type TransactionType = 'income' | 'expense'

export interface CreateTransactionInput {
  accountId: string
  categoryId: string | null
  date: string // YYYY-MM-DD
  payeeName: string
  amount: number // positive number; sign comes from `type`
  memo: string | null
  type: TransactionType
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

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

  // If a category was provided, verify it belongs to the same budget
  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const signedAmount =
    input.type === 'income' ? Math.abs(input.amount) : -Math.abs(input.amount)

  const { error: insertErr } = await supabase.from('transactions').insert({
    account_id: input.accountId,
    budget_id: budget.id,
    date: input.date,
    payee_name: input.payeeName.trim(),
    category_id: input.categoryId,
    memo: input.memo?.trim() || null,
    amount: signedAmount,
    cleared: 'uncleared',
    approved: true,
  })
  if (insertErr) return { error: insertErr.message }

  // Update the account's running balance
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

  // Optional category must belong to the budget.
  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const oldSignedAmount = Number(existing.amount)
  const newSignedAmount =
    input.type === 'income' ? Math.abs(input.amount) : -Math.abs(input.amount)

  const accountChanged = existing.account_id !== input.accountId

  // Update the transaction row first; if it fails, no balance changes happen.
  const { error: updateErr } = await supabase
    .from('transactions')
    .update({
      account_id: input.accountId,
      category_id: input.categoryId,
      date: input.date,
      payee_name: input.payeeName.trim(),
      memo: input.memo?.trim() || null,
      amount: newSignedAmount,
    })
    .eq('id', input.id)
  if (updateErr) return { error: updateErr.message }

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

  // Get the transaction (with account info) to roll back the balance
  const { data: txn } = await supabase
    .from('transactions')
    .select('id, account_id, amount, budget_id')
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

  const { data: account } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', txn.account_id)
    .single()
  if (!account) return { error: 'Cuenta asociada no encontrada' }

  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
  if (delErr) return { error: delErr.message }

  // Roll back the balance: subtract the transaction's amount
  const newBalance = Math.round((Number(account.balance) - Number(txn.amount)) * 100) / 100
  await supabase.from('accounts').update({ balance: newBalance }).eq('id', txn.account_id)

  revalidatePath('/app', 'layout')
  return { success: true as const }
}
