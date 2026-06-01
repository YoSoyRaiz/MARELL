import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { expandToCategoryContributions } from '@/lib/splits'
import { PlanView, type PlanCategory, type PlanGroup } from './PlanView'
import { PlanAnnualView, type AnnualOneOff } from './PlanAnnualView'
import { currentMonthDR, monthBoundsISO, MONTH_NAMES_FULL } from '@/lib/dates'

const currentMonth = currentMonthDR
const monthBounds = monthBoundsISO

const isValidMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
const isValidYear = (s: string) => /^\d{4}$/.test(s)

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; year?: string }>
}) {
  const params = await searchParams
  const view = params.view === 'anual' ? 'anual' : 'mensual'

  if (view === 'anual') {
    return <AnnualPage rawYear={params.year} />
  }

  const month = params.month && isValidMonth(params.month) ? params.month : currentMonth()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = activeBudgetId
    ? await supabase
        .from('budgets')
        .select('id, name, currency')
        .eq('id', activeBudgetId)
        .maybeSingle()
    : { data: null }

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

  // Build the group → categories tree.
  //
  // The "Metas" group is intentionally hidden from Plan: those categories
  // are managed in /app/metas where the user sets and tracks a savings
  // target. Showing them in Plan as regular monthly-budget rows was
  // confusing — "Fondo de emergencia" doesn't have a monthly assignment
  // in the YNAB sense; it's a savings goal funded over time.
  const HIDDEN_GROUPS = new Set(['Metas'])
  const groups: PlanGroup[] = groupsRaw
    .filter((g) => !HIDDEN_GROUPS.has((g.name as string) ?? ''))
    .map((g) => {
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

// ── Vista anual ──────────────────────────────────────────────────
// Pulls year-wide data:
//   - All monthly_assignments for the year (sum per month)
//   - All scheduled_transactions with frequency='once' falling in the year
//     (these son los "pagos extraordinarios")
// Returns 12 month buckets ready to render.

async function AnnualPage({ rawYear }: { rawYear?: string }) {
  const today = new Date()
  const year =
    rawYear && isValidYear(rawYear)
      ? parseInt(rawYear, 10)
      : today.getFullYear()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { budgetId: annualBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = annualBudgetId
    ? await supabase
        .from('budgets')
        .select('id')
        .eq('id', annualBudgetId)
        .maybeSingle()
    : { data: null }

  if (!budget) {
    return (
      <PlanAnnualView
        year={year}
        accounts={[]}
        categories={[]}
        months={emptyMonths(year)}
      />
    )
  }

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    assignmentsRes,
    scheduledRes,
    accountsRes,
    categoriesRes,
    groupsRes,
  ] = await Promise.all([
    // Pull all monthly_assignments whose `month` is within the year.
    // `month` column is text 'YYYY-MM', so we filter with prefix.
    supabase
      .from('monthly_assignments')
      .select('month, assigned')
      .eq('budget_id', budget.id)
      .like('month', `${year}-%`),
    // One-off scheduled txns falling within the year. The frequency
    // filter excludes recurrentes — those se ven en /app/programadas.
    supabase
      .from('scheduled_transactions')
      .select(
        'id, next_date, payee_name, amount, category_id, account_id, frequency, active',
      )
      .eq('budget_id', budget.id)
      .eq('frequency', 'once')
      .eq('active', true)
      .gte('next_date', yearStart)
      .lte('next_date', yearEnd),
    supabase
      .from('accounts')
      .select('id, name, closed')
      .eq('budget_id', budget.id),
    supabase
      .from('categories')
      .select('id, name, group_id')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('category_groups')
      .select('id, name')
      .eq('budget_id', budget.id),
  ])

  // Sum assignments por mes (e.g. '2026-04' → 12500).
  const assignedByMonth = new Map<string, number>()
  for (const a of assignmentsRes.data ?? []) {
    const m = a.month as string
    assignedByMonth.set(m, (assignedByMonth.get(m) ?? 0) + Number(a.assigned))
  }

  // Index categorías y cuentas para el render.
  const categoryNameById = new Map<string, string>()
  for (const c of categoriesRes.data ?? []) {
    categoryNameById.set(c.id as string, c.name as string)
  }
  const accountNameById = new Map<string, string>()
  for (const a of accountsRes.data ?? []) {
    accountNameById.set(a.id as string, a.name as string)
  }

  // Group categorías by group_name para el dropdown del modal.
  const groupNameById = new Map<string, string>()
  for (const g of groupsRes.data ?? []) {
    groupNameById.set(g.id as string, g.name as string)
  }
  // El grupo "Metas" no debería recibir pagos extraordinarios — son
  // metas de ahorro, no gastos planificados. Lo filtramos del selector.
  const categories = (categoriesRes.data ?? [])
    .filter((c) => groupNameById.get(c.group_id as string) !== 'Metas')
    .map((c) => ({
      id: c.id as string,
      name: c.name as string,
      group_name: groupNameById.get(c.group_id as string) ?? '—',
    }))

  const accounts = (accountsRes.data ?? [])
    .filter((a) => a.closed === false || a.closed === null)
    .map((a) => ({ id: a.id as string, name: a.name as string }))

  // Group one-offs por mes del año.
  const oneOffsByMonth = new Map<number, AnnualOneOff[]>()
  for (const s of scheduledRes.data ?? []) {
    const date = s.next_date as string
    const monthNum = parseInt(date.slice(5, 7), 10)
    if (!Number.isFinite(monthNum)) continue
    const list = oneOffsByMonth.get(monthNum) ?? []
    list.push({
      id: s.id as string,
      date,
      payeeName: (s.payee_name as string | null) ?? null,
      categoryName: s.category_id
        ? (categoryNameById.get(s.category_id as string) ?? null)
        : null,
      accountName: s.account_id
        ? (accountNameById.get(s.account_id as string) ?? null)
        : null,
      amount: Number(s.amount),
    })
    oneOffsByMonth.set(monthNum, list)
  }
  // Ordena cada lista por fecha asc (en el mismo mes).
  for (const list of oneOffsByMonth.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1
    const monthIso = `${year}-${String(monthNum).padStart(2, '0')}`
    const list = oneOffsByMonth.get(monthNum) ?? []
    const oneOffsExpense = list
      .filter((o) => o.amount < 0)
      .reduce((s, o) => s + Math.abs(o.amount), 0)
    const oneOffsIncome = list
      .filter((o) => o.amount > 0)
      .reduce((s, o) => s + o.amount, 0)
    return {
      monthIso,
      monthNum,
      monthLabel: `${MONTH_NAMES_FULL[monthNum - 1]} ${year}`,
      totalAssigned: Math.round((assignedByMonth.get(monthIso) ?? 0) * 100) / 100,
      oneOffs: list,
      oneOffsExpense: Math.round(oneOffsExpense * 100) / 100,
      oneOffsIncome: Math.round(oneOffsIncome * 100) / 100,
    }
  })

  return (
    <PlanAnnualView
      year={year}
      accounts={accounts}
      categories={categories}
      months={months}
    />
  )
}

function emptyMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const monthNum = i + 1
    return {
      monthIso: `${year}-${String(monthNum).padStart(2, '0')}`,
      monthNum,
      monthLabel: `${MONTH_NAMES_FULL[monthNum - 1]} ${year}`,
      totalAssigned: 0,
      oneOffs: [],
      oneOffsExpense: 0,
      oneOffsIncome: 0,
    }
  })
}
