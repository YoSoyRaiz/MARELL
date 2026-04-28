import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlanView, type PlanCategory, type PlanGroup } from './PlanView'

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0)
  const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(
    last.getDate(),
  ).padStart(2, '0')}`
  return { first, last: lastStr }
}

const isValidMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const month = params.month && isValidMonth(params.month) ? params.month : currentMonth()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!budget) {
    return <PlanView month={month} readyToAssign={0} groups={[]} hasBudget={false} />
  }

  const { first, last } = monthBounds(month)

  const [groupsRes, categoriesRes, assignmentsRes, txnsRes, accountsRes] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, group_id, sort_order, goal_amount')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budget.id)
      .eq('month', month),
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('budget_id', budget.id)
      .gte('date', first)
      .lte('date', last),
    supabase.from('accounts').select('balance, type').eq('budget_id', budget.id),
  ])

  const groupsRaw = groupsRes.data ?? []
  const categoriesRaw = categoriesRes.data ?? []
  const assignmentsRaw = assignmentsRes.data ?? []
  const txnsRaw = txnsRes.data ?? []
  const accountsRaw = accountsRes.data ?? []

  // Index assignments and activity by category id
  const assignedById = new Map<string, number>()
  for (const a of assignmentsRaw) {
    assignedById.set(a.category_id as string, Number(a.assigned))
  }

  const activityById = new Map<string, number>()
  for (const t of txnsRaw) {
    if (!t.category_id) continue
    const prev = activityById.get(t.category_id as string) ?? 0
    activityById.set(t.category_id as string, prev + Number(t.amount))
  }

  // Build the group → categories tree
  const groups: PlanGroup[] = groupsRaw.map((g) => {
    const cats: PlanCategory[] = categoriesRaw
      .filter((c) => c.group_id === g.id)
      .map((c) => {
        const assigned = assignedById.get(c.id as string) ?? 0
        const activity = activityById.get(c.id as string) ?? 0
        return {
          id: c.id as string,
          name: c.name as string,
          goal_amount: c.goal_amount === null ? null : Number(c.goal_amount),
          assigned,
          activity,
          available: assigned + activity, // activity is negative for spending
        }
      })
    return {
      id: g.id as string,
      name: g.name as string,
      categories: cats,
    }
  })

  // Ready-to-Assign = sum of cash account balances - total assigned this month
  const cashTypes = ['checking', 'savings', 'cash']
  const totalCash = accountsRaw
    .filter((a) => cashTypes.includes(a.type as string))
    .reduce((s, a) => s + Number(a.balance), 0)
  const totalAssigned = assignmentsRaw.reduce((s, a) => s + Number(a.assigned), 0)
  const readyToAssign = totalCash - totalAssigned

  return (
    <PlanView
      month={month}
      readyToAssign={readyToAssign}
      groups={groups}
      hasBudget={true}
    />
  )
}
