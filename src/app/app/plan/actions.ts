'use server'

import { createClient } from '@/lib/supabase/server'

const isValidMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export async function updateAssignment(
  budgetId: string,
  categoryId: string,
  month: string,
  assigned: number,
) {
  if (!isValidMonth(month)) return { error: 'Mes inválido' }
  if (!Number.isFinite(assigned) || assigned < 0) return { error: 'Monto inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que el budget pertenezca al user (RLS también lo bloquearía,
  // pero un check explícito da mensajes de error más claros).
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Presupuesto no encontrado' }

  // Verificar que la categoría pertenezca al budget.
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('budget_id', budgetId)
    .single()
  if (!category) return { error: 'Categoría no encontrada' }

  // Upsert sobre el unique(category_id, month).
  const rounded = Math.round(assigned * 100) / 100
  const { error } = await supabase
    .from('monthly_assignments')
    .upsert(
      {
        budget_id: budgetId,
        category_id: categoryId,
        month,
        assigned: rounded,
      },
      { onConflict: 'category_id,month' },
    )

  if (error) return { error: error.message }
  return { success: true as const }
}
