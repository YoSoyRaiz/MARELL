import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MetasClient, type ListGoal } from './MetasClient'
import type { CategoryOption } from './GoalFormModal'
import type { GoalType } from './actions'
import { currentMonthDR } from '@/lib/dates'

const currentMonth = currentMonthDR

export default async function MetasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!budget) {
    return <MetasClient goals={[]} availableCategories={[]} hasBudget={false} />
  }

  const month = currentMonth()

  const [groupsRes, catsRes] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name')
      .eq('budget_id', budget.id),
    supabase
      .from('categories')
      .select('id, name, group_id, goal_type, goal_amount, goal_date')
      .eq('budget_id', budget.id)
      .order('sort_order', { ascending: true }),
  ])

  const groupsById = new Map<string, string>()
  for (const g of groupsRes.data ?? []) {
    groupsById.set(g.id as string, g.name as string)
  }

  const allCats = catsRes.data ?? []

  // Categories belong on the Metas page when:
  //   - they have an explicit goal_amount > 0 (configured meta), OR
  //   - they live in the "Metas" category group (auto-classified during
  //     onboarding — these are savings buckets that need a target set,
  //     surfaced here as "configurar meta" placeholders).
  // Everything else is a regular spending category and stays in Plan.
  const isMetasGroup = (c: { group_id: string | null }) =>
    groupsById.get(c.group_id as string) === 'Metas'

  const goalCats = allCats.filter(
    (c) =>
      (c.goal_amount !== null && Number(c.goal_amount) > 0) || isMetasGroup(c),
  )
  const goalCatIds = goalCats.map((c) => c.id as string)

  // Categories without goals AND not in the Metas group → available to
  // be promoted to a meta via the "+" picker (e.g. promote "Viaje" from
  // Necesidades to a savings goal).
  const availableCategories: CategoryOption[] = allCats
    .filter(
      (c) =>
        (c.goal_amount === null || Number(c.goal_amount) === 0) &&
        !isMetasGroup(c),
    )
    .map((c) => ({
      id: c.id as string,
      name: c.name as string,
      group_name: groupsById.get(c.group_id as string) ?? '—',
    }))

  if (goalCats.length === 0) {
    return (
      <MetasClient
        goals={[]}
        availableCategories={availableCategories}
        hasBudget={true}
      />
    )
  }

  // Fetch this month's assignments + lifetime data for goals whose
  // progress is measured against lifetime balance (savings + by-date).
  const lifetimeGoalTypes = new Set(['savings_balance', 'needed_by'])
  const savingsCatIds = goalCats
    .filter((c) => lifetimeGoalTypes.has(c.goal_type as string))
    .map((c) => c.id as string)

  const [monthAssignsRes, lifetimeAssignsRes, lifetimeTxnsRes, lifetimeSubsRes] = await Promise.all([
    supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .in('category_id', goalCatIds)
      .eq('month', month),
    savingsCatIds.length > 0
      ? supabase
          .from('monthly_assignments')
          .select('category_id, assigned')
          .in('category_id', savingsCatIds)
      : Promise.resolve({ data: [] as Array<{ category_id: string; assigned: number }> }),
    savingsCatIds.length > 0
      ? supabase
          .from('transactions')
          .select('category_id, amount')
          .in('category_id', savingsCatIds)
          .lt('amount', 0)
      : Promise.resolve({ data: [] as Array<{ category_id: string; amount: number }> }),
    // Splits: subtransactions matching the savings categories with negative
    // amounts. RLS scopes them through transactions.budget_id automatically.
    savingsCatIds.length > 0
      ? supabase
          .from('subtransactions')
          .select('category_id, amount')
          .in('category_id', savingsCatIds)
          .lt('amount', 0)
      : Promise.resolve({ data: [] as Array<{ category_id: string; amount: number }> }),
  ])

  const monthAssignedById = new Map<string, number>()
  for (const a of monthAssignsRes.data ?? []) {
    monthAssignedById.set(a.category_id as string, Number(a.assigned))
  }

  const lifetimeAssignedById = new Map<string, number>()
  for (const a of lifetimeAssignsRes.data ?? []) {
    const id = a.category_id as string
    lifetimeAssignedById.set(id, (lifetimeAssignedById.get(id) ?? 0) + Number(a.assigned))
  }

  const lifetimeSpentById = new Map<string, number>()
  for (const t of lifetimeTxnsRes.data ?? []) {
    const id = t.category_id as string
    lifetimeSpentById.set(id, (lifetimeSpentById.get(id) ?? 0) + Math.abs(Number(t.amount)))
  }
  for (const s of lifetimeSubsRes.data ?? []) {
    const id = s.category_id as string
    lifetimeSpentById.set(id, (lifetimeSpentById.get(id) ?? 0) + Math.abs(Number(s.amount)))
  }

  const goals: ListGoal[] = goalCats.map((c) => {
    const id = c.id as string
    const goalAmount = c.goal_amount === null ? 0 : Number(c.goal_amount)
    const needsSetup = goalAmount <= 0
    // Default unsaved metas to savings_balance — that's the right shape
    // for the meta categories the onboarding creates (Fondo de emergencia,
    // Vacaciones, etc.) and matches what we backfill in the migration.
    const rawType = (c.goal_type as string | null) || 'savings_balance'
    const goalType: GoalType =
      rawType === 'savings_balance' || rawType === 'needed_by'
        ? (rawType as GoalType)
        : 'monthly_spending'

    let current = 0
    if (goalType === 'savings_balance' || goalType === 'needed_by') {
      const assigned = lifetimeAssignedById.get(id) ?? 0
      const spent = lifetimeSpentById.get(id) ?? 0
      current = assigned - spent
    } else {
      current = monthAssignedById.get(id) ?? 0
    }

    return {
      categoryId: id,
      categoryName: c.name as string,
      groupName: groupsById.get(c.group_id as string) ?? '—',
      goalType,
      goalAmount,
      goalDate: (c.goal_date as string | null) ?? null,
      current: Math.round(current * 100) / 100,
      needsSetup,
    }
  })

  return (
    <MetasClient
      goals={goals}
      availableCategories={availableCategories}
      hasBudget={true}
    />
  )
}
