'use server'

import { createClient } from '@/lib/supabase/server'
import { currentMonthDR } from '@/lib/dates'

const isValidMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

// ── Quick-assign popover support ──────────────────────────────────
// Fetches everything the topbar Asignar popover needs in one call:
// budget id, the categories grouped by parent group with their current-
// month assignment, and the global ready-to-assign baseline.

export interface AssignContextCategory {
  id: string
  name: string
  groupId: string
  groupName: string
  groupSort: number
  sortOrder: number
  assigned: number
  goalAmount: number | null
}

export interface AssignContextResult {
  budgetId: string | null
  month: string
  categories: AssignContextCategory[]
}

export async function fetchAssignContext(): Promise<AssignContextResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { budgetId: null, month: currentMonthDR(), categories: [] }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { budgetId: null, month: currentMonthDR(), categories: [] }

  const month = currentMonthDR()

  const [groupsRes, catsRes, assignsRes] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id),
    supabase
      .from('categories')
      .select('id, name, group_id, sort_order, goal_amount')
      .eq('budget_id', budget.id)
      .eq('hidden', false)
      .order('sort_order'),
    supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budget.id)
      .eq('month', month),
  ])

  const groupsById = new Map<string, { name: string; sort: number }>()
  for (const g of groupsRes.data ?? []) {
    groupsById.set(g.id as string, {
      name: g.name as string,
      sort: Number(g.sort_order ?? 0),
    })
  }

  const assignedById = new Map<string, number>()
  for (const a of assignsRes.data ?? []) {
    assignedById.set(a.category_id as string, Number(a.assigned))
  }

  const categories: AssignContextCategory[] = (catsRes.data ?? []).map((c) => {
    const gid = c.group_id as string
    const grp = groupsById.get(gid)
    return {
      id: c.id as string,
      name: c.name as string,
      groupId: gid,
      groupName: grp?.name ?? '—',
      groupSort: grp?.sort ?? 0,
      sortOrder: Number(c.sort_order ?? 0),
      assigned: assignedById.get(c.id as string) ?? 0,
      goalAmount: c.goal_amount === null ? null : Number(c.goal_amount),
    }
  })

  return { budgetId: budget.id as string, month, categories }
}

/**
 * Assign a positive amount to a category for a given month.
 * - mode='set' replaces the current assignment with `amount`.
 * - mode='add' adds `amount` on top of the current assignment.
 *
 * Returns the new assignment value so callers can update local UI / the
 * ready-to-assign pill optimistically.
 */
export type QuickAssignResult =
  | { error: string }
  | { success: true; assigned: number; delta: number }

export async function quickAssign(
  budgetId: string,
  categoryId: string,
  month: string,
  amount: number,
  mode: 'set' | 'add',
): Promise<QuickAssignResult> {
  if (!isValidMonth(month)) return { error: 'Mes inválido' }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'Monto inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Presupuesto no encontrado' }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('budget_id', budgetId)
    .single()
  if (!category) return { error: 'Categoría no encontrada' }

  const { data: existing } = await supabase
    .from('monthly_assignments')
    .select('assigned')
    .eq('budget_id', budgetId)
    .eq('category_id', categoryId)
    .eq('month', month)
    .maybeSingle()
  const previous = Number(existing?.assigned ?? 0)
  const next = mode === 'add' ? previous + amount : amount

  const rounded = Math.round(next * 100) / 100
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

  return {
    success: true,
    assigned: rounded,
    delta: rounded - previous,
  }
}

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
