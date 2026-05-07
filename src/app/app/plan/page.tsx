import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { expandToCategoryContributions } from '@/lib/splits'
import { PlanView, type PlanCategory, type PlanGroup } from './PlanView'
import { currentMonthDR, monthBoundsISO } from '@/lib/dates'

const currentMonth = currentMonthDR
const monthBounds = monthBoundsISO

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
    return <PlanView budgetId={null} month={month} groups={[]} />
  }

  const { first, last } = monthBounds(month)

  // Pull this-month assignments + activity for the columns the user sees,
  // PLUS lifetime data so we can compute carry-over correctly. Lifetime
  // available = sum(all months' assignments) + sum(all activity ever),
  // mirroring YNAB's "Available" column. Without this, every new month
  // starts a category at $0 and previously saved balances disappear.
  const [
    groupsRes,
    categoriesRes,
    assignmentsThisMonthRes,
    assignmentsLifetimeRes,
    txnsThisMonthRes,
    txnsLifetimeRes,
    subsLifetimeRes,
    accountsRes,
  ] = await Promise.all([
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
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budget.id),
    supabase
      .from('transactions')
      .select(
        'id, date, category_id, amount, is_split, subtransactions(category_id, amount)',
      )
      .eq('budget_id', budget.id)
      .gte('date', first)
      .lte('date', last),
    supabase
      .from('transactions')
      .select('id, date, category_id, amount')
      .eq('budget_id', budget.id)
      .not('category_id', 'is', null),
    supabase
      .from('subtransactions')
      .select('category_id, amount, transactions!inner(budget_id)')
      .eq('transactions.budget_id', budget.id)
      .not('category_id', 'is', null),
    supabase.from('accounts').select('id, name, balance, type, closed').eq('budget_id', budget.id),
  ])

  const groupsRaw = groupsRes.data ?? []
  const categoriesRaw = categoriesRes.data ?? []
  const assignmentsThisMonth = assignmentsThisMonthRes.data ?? []
  const assignmentsLifetime = assignmentsLifetimeRes.data ?? []
  const txnsThisMonth = txnsThisMonthRes.data ?? []
  const txnsLifetime = txnsLifetimeRes.data ?? []
  const subsLifetime = subsLifetimeRes.data ?? []
  const accountsRaw = accountsRes.data ?? []

  // Index this-month assignment + activity by category id (the columns
  // the user reads in the Plan view's table).
  const assignedThisMonthById = new Map<string, number>()
  for (const a of assignmentsThisMonth) {
    assignedThisMonthById.set(a.category_id as string, Number(a.assigned))
  }

  const activityThisMonthById = new Map<string, number>()
  for (const c of expandToCategoryContributions(txnsThisMonth)) {
    if (!c.category_id) continue
    const prev = activityThisMonthById.get(c.category_id) ?? 0
    activityThisMonthById.set(c.category_id, prev + c.amount)
  }

  // Index lifetime assignment + activity by category id (used for the
  // "Disponible" column — carries balance forward from prior months).
  const assignedLifetimeById = new Map<string, number>()
  for (const a of assignmentsLifetime) {
    const id = a.category_id as string
    assignedLifetimeById.set(id, (assignedLifetimeById.get(id) ?? 0) + Number(a.assigned))
  }

  const activityLifetimeById = new Map<string, number>()
  for (const t of txnsLifetime) {
    const id = t.category_id as string
    activityLifetimeById.set(id, (activityLifetimeById.get(id) ?? 0) + Number(t.amount))
  }
  for (const s of subsLifetime) {
    const id = s.category_id as string
    activityLifetimeById.set(id, (activityLifetimeById.get(id) ?? 0) + Number(s.amount))
  }

  // Build the group → categories tree
  const groups: PlanGroup[] = groupsRaw.map((g) => {
    const cats: PlanCategory[] = categoriesRaw
      .filter((c) => c.group_id === g.id)
      .map((c) => {
        const id = c.id as string
        const assigned = assignedThisMonthById.get(id) ?? 0
        const activity = activityThisMonthById.get(id) ?? 0
        const available =
          (assignedLifetimeById.get(id) ?? 0) + (activityLifetimeById.get(id) ?? 0)
        return {
          id,
          name: c.name as string,
          goal_amount: c.goal_amount === null ? null : Number(c.goal_amount),
          assigned,
          activity,
          available: Math.round(available * 100) / 100,
        }
      })
    return {
      id: g.id as string,
      name: g.name as string,
      categories: cats,
    }
  })

  // Active accounts for the per-category "Pagar desde…" dropdown.
  const planAccounts = accountsRaw
    .filter((a) => a.closed === false || a.closed === null || a.closed === undefined)
    .map((a) => ({ id: a.id as string, name: a.name as string }))

  return (
    <PlanView
      budgetId={budget.id as string}
      month={month}
      groups={groups}
      accounts={planAccounts}
    />
  )
}
