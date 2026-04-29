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

// Helper exposed for the client component
export { accountCategoryFromType }
