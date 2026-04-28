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
