'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type GoalType = 'monthly_spending' | 'savings_balance'

export interface UpdateGoalInput {
  categoryId: string
  goalType: GoalType
  goalAmount: number
  goalDate: string | null // YYYY-MM-DD
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function updateGoal(input: UpdateGoalInput) {
  if (!input.categoryId) return { error: 'Categoría requerida' }
  if (input.goalType !== 'monthly_spending' && input.goalType !== 'savings_balance') {
    return { error: 'Tipo de meta inválido' }
  }
  if (!Number.isFinite(input.goalAmount) || input.goalAmount <= 0) {
    return { error: 'Monto inválido' }
  }
  if (input.goalDate !== null && !isValidDate(input.goalDate)) {
    return { error: 'Fecha inválida' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, budget_id')
    .eq('id', input.categoryId)
    .single()
  if (!cat) return { error: 'Categoría no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', cat.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const rounded = Math.round(input.goalAmount * 100) / 100

  const { error } = await supabase
    .from('categories')
    .update({
      goal_type: input.goalType,
      goal_amount: rounded,
      goal_monthly: input.goalType === 'monthly_spending' ? rounded : null,
      goal_date: input.goalDate,
    })
    .eq('id', input.categoryId)

  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function clearGoal(categoryId: string) {
  if (!categoryId) return { error: 'Categoría requerida' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, budget_id')
    .eq('id', categoryId)
    .single()
  if (!cat) return { error: 'Categoría no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', cat.budget_id)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('categories')
    .update({
      goal_type: null,
      goal_amount: null,
      goal_monthly: null,
      goal_date: null,
    })
    .eq('id', categoryId)

  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}
