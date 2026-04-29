import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MetasClient, type ListGoal } from './MetasClient'
import type { CategoryOption } from './GoalFormModal'
import type { GoalType } from './actions'

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

  // Categories with goals
  const goalCats = allCats.filter(
    (c) => c.goal_amount !== null && Number(c.goal_amount) > 0,
  )
  const goalCatIds = goalCats.map((c) => c.id as string)

  // Categories without goals (for the add picker)
  const availableCategories: CategoryOption[] = allCats
    .filter((c) => c.goal_amount === null || Number(c.goal_amount) === 0)
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

  // Fetch this month's assignments + lifetime data for savings goals
  const savingsCatIds = goalCats
    .filter((c) => (c.goal_type as string) === 'savings_balance')
    .map((c) => c.id as string)

  const [monthAssignsRes, lifetimeAssignsRes, lifetimeTxnsRes] = await Promise.all([
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

  const goals: ListGoal[] = goalCats.map((c) => {
    const id = c.id as string
    const type = (c.goal_type as string) || 'monthly_spending'
    const goalType: GoalType =
      type === 'savings_balance' ? 'savings_balance' : 'monthly_spending'

    let current = 0
    if (goalType === 'savings_balance') {
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
      goalAmount: Number(c.goal_amount),
      goalDate: (c.goal_date as string | null) ?? null,
      current: Math.round(current * 100) / 100,
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
