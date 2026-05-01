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

// ── Auto-assign templates (YNAB-style "Auto" tab) ─────────────────

export type AutoTemplate =
  | 'assigned_last_month'
  | 'spent_last_month'
  | 'reset_assigned'

export interface AutoAssignResult {
  error?: string
  changedCount?: number
  totalDelta?: number
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1) // m-1 then -1
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Bulk-assign across all categories using a YNAB-style preset.
 *  - 'assigned_last_month' overwrites this month with each category's
 *    previous-month assignment.
 *  - 'spent_last_month' overwrites this month with last month's spending
 *    (so you "fund what you actually used").
 *  - 'reset_assigned' wipes every current-month assignment back to 0.
 */
export async function applyAutoAssign(
  budgetId: string,
  month: string,
  template: AutoTemplate,
): Promise<AutoAssignResult> {
  if (!isValidMonth(month)) return { error: 'Mes inválido' }

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

  // Get this month's existing assignments so we can compute deltas.
  const { data: thisMonthAssignsRaw } = await supabase
    .from('monthly_assignments')
    .select('category_id, assigned')
    .eq('budget_id', budgetId)
    .eq('month', month)
  const thisMonth = new Map<string, number>()
  for (const a of thisMonthAssignsRaw ?? []) {
    thisMonth.set(a.category_id as string, Number(a.assigned))
  }

  // Build the target map: cat_id → desired assignment for this month.
  const targets = new Map<string, number>()

  if (template === 'reset_assigned') {
    for (const [id] of thisMonth) targets.set(id, 0)
  } else if (template === 'assigned_last_month') {
    const prev = previousMonth(month)
    const { data: prevAssigns } = await supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budgetId)
      .eq('month', prev)
    for (const a of prevAssigns ?? []) {
      targets.set(a.category_id as string, Number(a.assigned))
    }
  } else if (template === 'spent_last_month') {
    const prev = previousMonth(month)
    const [y, m] = prev.split('-').map(Number)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    const last = new Date(y, m, 0)
    const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    const [txnsRes, subsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('budget_id', budgetId)
        .gte('date', first)
        .lte('date', lastStr)
        .lt('amount', 0)
        .not('category_id', 'is', null),
      supabase
        .from('subtransactions')
        .select('category_id, amount, transactions!inner(budget_id, date)')
        .eq('transactions.budget_id', budgetId)
        .gte('transactions.date', first)
        .lte('transactions.date', lastStr)
        .lt('amount', 0)
        .not('category_id', 'is', null),
    ])
    for (const t of txnsRes.data ?? []) {
      const id = t.category_id as string
      targets.set(id, (targets.get(id) ?? 0) + Math.abs(Number(t.amount)))
    }
    for (const s of subsRes.data ?? []) {
      const id = s.category_id as string
      targets.set(id, (targets.get(id) ?? 0) + Math.abs(Number(s.amount)))
    }
  }

  // Apply: upsert each target. Track delta for the topbar update.
  let totalDelta = 0
  let changedCount = 0
  for (const [categoryId, value] of targets) {
    const rounded = Math.round(value * 100) / 100
    const previous = thisMonth.get(categoryId) ?? 0
    if (Math.abs(rounded - previous) < 0.005) continue
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
    totalDelta += rounded - previous
    changedCount += 1
  }

  return { changedCount, totalDelta: Math.round(totalDelta * 100) / 100 }
}

// ── Move money between categories (YNAB "Where's-Available-Money") ─

export type MoveMoneyResult =
  | { error: string }
  | {
      success: true
      fromAssigned: number
      toAssigned: number
    }

/**
 * Reassigns `amount` from one category to another for a given month.
 * Implemented as: from.assigned -= amount, to.assigned += amount. Net
 * Ready-to-Assign delta is zero so the topbar pill doesn't move.
 *
 * The source can go negative (YNAB-style "took back from prior carry-
 * over"); that surfaces as overspent in the row.
 */
export async function moveMoneyBetweenCategories(
  budgetId: string,
  fromCategoryId: string,
  toCategoryId: string,
  month: string,
  amount: number,
): Promise<MoveMoneyResult> {
  if (!isValidMonth(month)) return { error: 'Mes inválido' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Monto inválido' }
  if (fromCategoryId === toCategoryId) {
    return { error: 'Origen y destino deben ser distintos' }
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

  const { data: cats } = await supabase
    .from('categories')
    .select('id')
    .eq('budget_id', budgetId)
    .in('id', [fromCategoryId, toCategoryId])
  if (!cats || cats.length !== 2) return { error: 'Categoría no encontrada' }

  const { data: existing } = await supabase
    .from('monthly_assignments')
    .select('category_id, assigned')
    .eq('budget_id', budgetId)
    .eq('month', month)
    .in('category_id', [fromCategoryId, toCategoryId])
  const current = new Map<string, number>()
  for (const row of existing ?? []) {
    current.set(row.category_id as string, Number(row.assigned))
  }

  const fromPrev = current.get(fromCategoryId) ?? 0
  const toPrev = current.get(toCategoryId) ?? 0
  const fromNext = Math.round((fromPrev - amount) * 100) / 100
  const toNext = Math.round((toPrev + amount) * 100) / 100

  const { error } = await supabase.from('monthly_assignments').upsert(
    [
      {
        budget_id: budgetId,
        category_id: fromCategoryId,
        month,
        assigned: fromNext,
      },
      {
        budget_id: budgetId,
        category_id: toCategoryId,
        month,
        assigned: toNext,
      },
    ],
    { onConflict: 'category_id,month' },
  )
  if (error) return { error: error.message }

  return {
    success: true,
    fromAssigned: fromNext,
    toAssigned: toNext,
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
