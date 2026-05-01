import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  PiggyBank,
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { expandToCategoryContributions } from '@/lib/splits'
import {
  formatMoney as fmtMoneyWithCurrency,
  formatMoneyShort as fmtMoneyShortWithCurrency,
  parseCurrency,
  convertAmount,
  type Currency as MoneyCurrency,
} from '@/lib/money'
import { DonutChart } from './DonutChart'
import { CategoryCardsSection, type SectionGroup } from './CategoryCardsSection'
import { RecentTransactionsSection, type RecentTxn } from './RecentTransactionsSection'
import { InsightsSection, type InsightInputs } from './InsightsSection'
import { materializeDue } from './programadas/actions'
import { currentMonthDR, monthBoundsISO, todayISODR } from '@/lib/dates'
import { UpcomingCommitments, type UpcomingItem } from './UpcomingCommitments'

const currentMonth = currentMonthDR
const monthBounds = monthBoundsISO

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const formatMonthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export default async function ResumenPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!budget) {
    return (
      <div className="space-y-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Resumen
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Aún no tienes <span className="gradient-text">presupuesto</span>.
        </h1>
        <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
          Termina el onboarding para construir tu plan.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[14px] rounded-xl glow-on-hover hover:brightness-105 transition-[filter]"
        >
          Empezar onboarding <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    )
  }

  // Materialize any due scheduled transactions before fetching dashboard data
  // so the recurring income/expenses are reflected in account balances and the
  // current month's totals immediately when the user opens the app.
  // Wrapped: a failure here shouldn't 500 the entire dashboard.
  try {
    await materializeDue(budget.id as string)
  } catch (err) {
    console.error('[materializeDue] failed', err)
  }

  const currency = parseCurrency(budget.currency as string | null)
  const fmtMoney = (n: number) => fmtMoneyWithCurrency(n, currency)
  const fmtMoneyShort = (n: number) => fmtMoneyShortWithCurrency(n, currency)

  const month = currentMonth()
  const { first, last } = monthBounds(month)

  // 14-day window for the cash-flow forecast widget.
  const today = todayISODR()
  const horizonDate = (() => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 14)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  })()

  const [
    groupsRes,
    catsRes,
    accountsRes,
    assignmentsRes,
    assignmentsLifetimeRes,
    txnsMonthRes,
    txnsLifetimeRes,
    subsLifetimeRes,
    txnsRecentRes,
    upcomingRes,
  ] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, group_id, goal_amount, goal_type, goal_date')
      .eq('budget_id', budget.id),
    supabase
      .from('accounts')
      .select('id, name, type, balance, currency, closed')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budget.id)
      .eq('month', month),
    // Lifetime assignments — needed for carry-over math on the dashboard
    // category cards so they reflect what's actually available, not just
    // what was assigned this month.
    supabase
      .from('monthly_assignments')
      .select('category_id, assigned')
      .eq('budget_id', budget.id),
    // Full month — drives totals (income / expense) and per-category activity.
    supabase
      .from('transactions')
      .select(
        'date, category_id, amount, is_split, transfer_account_id, subtransactions(category_id, amount)',
      )
      .eq('budget_id', budget.id)
      .gte('date', first)
      .lte('date', last),
    // Lifetime categorized activity — for carry-over.
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('budget_id', budget.id)
      .not('category_id', 'is', null),
    supabase
      .from('subtransactions')
      .select('category_id, amount, transactions!inner(budget_id)')
      .eq('transactions.budget_id', budget.id)
      .not('category_id', 'is', null),
    // Just the 5 most recent for the "Transacciones recientes" widget.
    supabase
      .from('transactions')
      .select('id, date, payee_name, category_id, amount')
      .eq('budget_id', budget.id)
      .gte('date', first)
      .lte('date', last)
      .order('date', { ascending: false })
      .limit(5),
    // Upcoming scheduled transactions in the next 14 days — drives the
    // "Próximos compromisos" cash-flow forecast widget.
    supabase
      .from('scheduled_transactions')
      .select('id, payee_name, category_id, account_id, amount, next_date, frequency')
      .eq('budget_id', budget.id)
      .eq('active', true)
      .gte('next_date', today)
      .lte('next_date', horizonDate)
      .order('next_date', { ascending: true }),
  ])

  const groupsData = groupsRes.data ?? []
  const catsData = catsRes.data ?? []
  const accountsData = accountsRes.data ?? []
  const assignmentsData = assignmentsRes.data ?? []
  const txnsMonthData = txnsMonthRes.data ?? []
  const txnsRecentData = txnsRecentRes.data ?? []
  const upcomingData = upcomingRes.data ?? []

  // KPI computations
  const cashTypes = ['checking', 'savings', 'cash']
  const debtTypes = [
    'credit_card',
    'line_of_credit',
    'mortgage',
    'auto_loan',
    'student_loan',
    'personal_loan',
    'medical_debt',
    'other_debt',
  ]
  const investmentTypes = ['asset', 'investment']

  // Normalize each account balance into the budget's currency before
  // summing. Mixed-currency portfolios (e.g. DOP corriente + USD ahorros)
  // would otherwise produce nonsense totals.
  const fxRate = Number(
    (budget as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ?? 60,
  )
  const budgetMoneyCurrency: MoneyCurrency = currency
  const accountBalanceInBudget = (a: { balance: number; currency: string | null }) => {
    const accCurrency = parseCurrency(a.currency)
    return convertAmount(Number(a.balance), accCurrency, budgetMoneyCurrency, fxRate)
  }
  const totalCash = accountsData
    .filter((a) => cashTypes.includes(a.type as string))
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )
  const totalSavings = accountsData
    .filter((a) => a.type === 'savings')
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )
  const totalDebt = accountsData
    .filter((a) => debtTypes.includes(a.type as string))
    .reduce(
      (s, a) =>
        s +
        Math.abs(
          accountBalanceInBudget({
            balance: Number(a.balance),
            currency: (a.currency as string | null) ?? null,
          }),
        ),
      0,
    )
  const totalInvestments = accountsData
    .filter((a) => investmentTypes.includes(a.type as string))
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )

  const netWorth = totalCash + totalInvestments - totalDebt

  // Income / expense come from the *full* month. Transfers (rows with
  // transfer_account_id set) are excluded — they just move money between
  // accounts and shouldn't inflate either side. Splits don't change parent
  // sign, so counting parents is correct for these aggregates.
  const nonTransfer = txnsMonthData.filter((t) => !t.transfer_account_id)
  const totalIncome = nonTransfer
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = nonTransfer
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const totalAssigned = assignmentsData.reduce((s, a) => s + Number(a.assigned), 0)

  // Ready-to-Assign uses the SAME lifetime formula as the topbar pill
  // (layout.tsx) so the resumen sidebar and the topbar always match. The
  // old `cash − assigned-this-month` shortcut was misleading because it
  // ignored carry-over from prior months and over-categorized inflows.
  const totalCategorizedActivityLifetime =
    (txnsLifetimeRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0) +
    (subsLifetimeRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0)
  const totalAssignedLifetime = (assignmentsLifetimeRes.data ?? []).reduce(
    (s, a) => s + Number(a.assigned),
    0,
  )
  const readyToAssign = Math.round(
    (totalCash - (totalAssignedLifetime + totalCategorizedActivityLifetime)) * 100,
  ) / 100

  // Modal data for the in-place "+ Agregar transacción" CTA
  const modalAccounts = accountsData
    .filter((a) => a.closed === false || a.closed === null || a.closed === undefined)
    .map((a) => ({ id: a.id as string, name: a.name as string }))

  const modalCategories = catsData.map((c) => {
    const groupName = groupsData.find((g) => g.id === c.group_id)?.name as string | undefined
    return {
      id: c.id as string,
      name: c.name as string,
      group_name: groupName ?? '—',
    }
  })

  const recentTxns: RecentTxn[] = txnsRecentData.map((t) => ({
    id: t.id as string,
    date: t.date as string,
    payee_name: (t.payee_name as string | null) ?? null,
    category_name: t.category_id
      ? (catsData.find((c) => c.id === t.category_id)?.name as string | undefined) ?? null
      : null,
    amount: Number(t.amount),
  }))

  // Expand any split parent into its children so per-category activity counts
  // correctly when a transaction touches multiple categories. Uses the full
  // month set, not the 5-row recent slice.
  const txnContributions = expandToCategoryContributions(txnsMonthData)

  // Lifetime per-category aggregates for carry-over (used by the dashboard
  // category cards). Different from the savings-goal lifetime maps below
  // because that section uses absolute-value spent semantics.
  const carryAssignedById = new Map<string, number>()
  for (const a of assignmentsLifetimeRes.data ?? []) {
    const id = a.category_id as string
    carryAssignedById.set(id, (carryAssignedById.get(id) ?? 0) + Number(a.assigned))
  }
  const carryActivityById = new Map<string, number>()
  for (const t of txnsLifetimeRes.data ?? []) {
    const id = t.category_id as string
    carryActivityById.set(id, (carryActivityById.get(id) ?? 0) + Number(t.amount))
  }
  for (const s of subsLifetimeRes.data ?? []) {
    const id = s.category_id as string
    carryActivityById.set(id, (carryActivityById.get(id) ?? 0) + Number(s.amount))
  }

  // Per-group + per-category breakdown for the categorías cards (used by the modal)
  const sectionGroups: SectionGroup[] = groupsData.map((g) => {
    const groupCats = catsData.filter((c) => c.group_id === g.id)
    const categories = groupCats.map((c) => {
      const a = assignmentsData.find((x) => x.category_id === c.id)
      const activity = txnContributions
        .filter((t) => t.category_id === c.id)
        .reduce((s, t) => s + t.amount, 0)
      const available =
        (carryAssignedById.get(c.id as string) ?? 0) +
        (carryActivityById.get(c.id as string) ?? 0)
      return {
        id: c.id as string,
        name: c.name as string,
        assigned: Number(a?.assigned ?? 0),
        activity,
        available: Math.round(available * 100) / 100,
        goal_amount: c.goal_amount === null ? null : Number(c.goal_amount),
      }
    })
    const assigned = categories.reduce((s, c) => s + c.assigned, 0)
    const spent = categories
      .filter((c) => c.activity < 0)
      .reduce((s, c) => s + Math.abs(c.activity), 0)
    const available = categories.reduce((s, c) => s + c.available, 0)
    return {
      id: g.id as string,
      name: g.name as string,
      categories,
      assigned,
      spent,
      available: Math.round(available * 100) / 100,
    }
  })

  // ── Goals preview (up to 4) ────────────────────────────────
  // Mirrors the calculation on /app/metas: monthly_spending uses the current
  // month's assignment, savings_balance uses lifetime (assigned − spent).
  type GoalType = 'monthly_spending' | 'savings_balance' | 'needed_by'

  const goalCats = catsData.filter(
    (c) => c.goal_amount !== null && Number(c.goal_amount) > 0,
  )
  // savings_balance and needed_by both measure progress against lifetime
  // balance, so they share the same query path.
  const savingsGoalIds = goalCats
    .filter((c) => {
      const t = c.goal_type as string | null
      return t === 'savings_balance' || t === 'needed_by'
    })
    .map((c) => c.id as string)

  // For savings goals we need lifetime aggregates. Skip the queries entirely
  // if there are none, to keep the dashboard light.
  const lifetimeAssignedById = new Map<string, number>()
  const lifetimeSpentById = new Map<string, number>()
  if (savingsGoalIds.length > 0) {
    const [lifeAssignsRes, lifeTxnsRes, lifeSubsRes] = await Promise.all([
      supabase
        .from('monthly_assignments')
        .select('category_id, assigned')
        .in('category_id', savingsGoalIds),
      supabase
        .from('transactions')
        .select('category_id, amount')
        .in('category_id', savingsGoalIds)
        .lt('amount', 0),
      supabase
        .from('subtransactions')
        .select('category_id, amount')
        .in('category_id', savingsGoalIds)
        .lt('amount', 0),
    ])
    for (const a of lifeAssignsRes.data ?? []) {
      const id = a.category_id as string
      lifetimeAssignedById.set(id, (lifetimeAssignedById.get(id) ?? 0) + Number(a.assigned))
    }
    for (const t of lifeTxnsRes.data ?? []) {
      const id = t.category_id as string
      lifetimeSpentById.set(id, (lifetimeSpentById.get(id) ?? 0) + Math.abs(Number(t.amount)))
    }
    for (const s of lifeSubsRes.data ?? []) {
      const id = s.category_id as string
      lifetimeSpentById.set(id, (lifetimeSpentById.get(id) ?? 0) + Math.abs(Number(s.amount)))
    }
  }

  const goals = goalCats
    .map((c) => {
      const id = c.id as string
      const rawType = c.goal_type as string | null
      const goalType: GoalType =
        rawType === 'savings_balance' || rawType === 'needed_by'
          ? (rawType as GoalType)
          : 'monthly_spending'
      const goal = Number(c.goal_amount ?? 0)
      let current = 0
      if (goalType === 'savings_balance' || goalType === 'needed_by') {
        current = (lifetimeAssignedById.get(id) ?? 0) - (lifetimeSpentById.get(id) ?? 0)
      } else {
        const a = assignmentsData.find((x) => x.category_id === id)
        current = Number(a?.assigned ?? 0)
      }
      return {
        id,
        name: c.name as string,
        goalType,
        current: Math.round(current * 100) / 100,
        goal,
        progress: goal > 0 ? Math.min(1, current / goal) : 0,
      }
    })
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4)

  const firstName = (profile?.display_name ?? '').trim().split(/\s+/)[0] || 'amigo'

  // Insights inputs — these aggregate signals already computed above so
  // we don't issue any extra Supabase queries.
  const overspentCount = sectionGroups.reduce((acc, g) => {
    return (
      acc +
      g.categories.filter((c) => c.available < -0.005).length
    )
  }, 0)

  // A "goal" here means a category with a positive monthly target. We
  // only count monthly_spending-style goals as "undermet" — savings
  // goals don't have a per-month obligation in the same way.
  const undermetGoalsCount = catsData.filter((c) => {
    const goalAmount = c.goal_amount === null ? 0 : Number(c.goal_amount)
    if (goalAmount <= 0) return false
    if ((c.goal_type as string) !== 'monthly_spending' && c.goal_type !== null) {
      return false
    }
    const a = assignmentsData.find((x) => x.category_id === c.id)
    const assigned = Number(a?.assigned ?? 0)
    return assigned + 0.005 < goalAmount
  }).length

  // Top expense category this month: build from txn contributions so
  // splits count correctly.
  const expenseByCategory = new Map<string, number>()
  for (const t of txnContributions) {
    if (t.amount < 0 && t.category_id) {
      expenseByCategory.set(
        t.category_id,
        (expenseByCategory.get(t.category_id) ?? 0) + Math.abs(t.amount),
      )
    }
  }
  let topExpenseEntry: { name: string; amount: number } | null = null
  for (const [catId, amount] of expenseByCategory) {
    const cat = catsData.find((c) => c.id === catId)
    if (!cat) continue
    if (!topExpenseEntry || amount > topExpenseEntry.amount) {
      topExpenseEntry = { name: cat.name as string, amount }
    }
  }

  // Closest in-progress goal — top of the goals array (already sorted by
  // progress desc) that's still under 100%.
  const closestGoalEntry = (() => {
    const cand = goals.find((g) => g.progress < 1 && g.progress > 0)
    if (!cand) return null
    return {
      name: cand.name,
      progress: cand.progress,
      remaining: Math.max(0, cand.goal - cand.current),
    }
  })()

  // Upcoming scheduled transactions (next 14 days).
  const accountNameById = new Map<string, string>()
  for (const a of accountsData) {
    accountNameById.set(a.id as string, a.name as string)
  }
  const upcomingItems: UpcomingItem[] = upcomingData.map((s) => {
    const catName = s.category_id
      ? ((catsData.find((c) => c.id === s.category_id)?.name as string | undefined) ?? null)
      : null
    return {
      id: s.id as string,
      date: s.next_date as string,
      payeeName: (s.payee_name as string | null) ?? null,
      categoryName: catName,
      accountName: accountNameById.get(s.account_id as string) ?? '—',
      amount: Number(s.amount ?? 0),
      frequency: s.frequency as string,
    }
  })

  // Projected end-of-window cash: today's cash + sum of upcoming amounts.
  // Inflows are positive, outflows negative; the running balance shows the
  // user whether they'll be in the red before the 14 days end.
  const upcomingNetFlow = upcomingItems.reduce((s, i) => s + i.amount, 0)
  const projectedCash = Math.round((totalCash + upcomingNetFlow) * 100) / 100

  const insightInputs: InsightInputs = {
    readyToAssign,
    totalAssignedThisMonth: totalAssigned,
    overspentCount,
    undermetGoalsCount,
    topExpense: topExpenseEntry,
    closestGoal: closestGoalEntry,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* LEFT COLUMN */}
      <div className="space-y-7 min-w-0">
        {/* Greeting */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Resumen · {formatMonthLabel(month)}
          </div>
          <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
            Tu mes en una <span className="gradient-text">mirada</span>, {firstName}.
          </h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            label="Ingresos"
            value={totalIncome}
            Icon={TrendingUp}
            iconBg="bg-[rgba(61,220,151,0.10)]"
            iconColor="text-[var(--brand-2)]"
            sublabel="Este mes"
            fmtMoney={fmtMoney}
          />
          <KpiCard
            label="Gastos"
            value={totalExpenses}
            Icon={TrendingDown}
            iconBg="bg-[rgba(255,122,89,0.10)]"
            iconColor="text-[var(--coral)]"
            sublabel="Este mes"
            href="/app/plan"
            fmtMoney={fmtMoney}
          />
          <KpiCard
            label="Ahorros"
            value={totalSavings}
            Icon={PiggyBank}
            iconBg="bg-[rgba(77,168,255,0.10)]"
            iconColor="text-[var(--info)]"
            sublabel="Cuentas de ahorro"
            fmtMoney={fmtMoney}
          />
          <KpiCard
            label="Patrimonio neto"
            value={netWorth}
            Icon={Wallet}
            iconBg="bg-[rgba(245,200,66,0.10)]"
            iconColor="text-[var(--warn)]"
            sublabel="Activos − deudas"
            fmtMoney={fmtMoney}
          />
        </div>

        {/* Categories cards (with click-to-edit modal) */}
        <CategoryCardsSection
          budgetId={budget.id as string}
          month={month}
          groups={sectionGroups}
        />

        {/* Recent transactions (with in-place add modal) */}
        <RecentTransactionsSection
          transactions={recentTxns}
          accounts={modalAccounts}
          categories={modalCategories}
        />

      </div>

      {/* RIGHT COLUMN */}
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        {/* Resumen del mes */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-[14px] font-semibold text-[var(--text)]">
              Resumen de {formatMonthLabel(month).split(' ')[0]}
            </h2>
          </header>
          <ul className="divide-y divide-[var(--border)]">
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-[13px] text-[var(--text2)]">Ingresos</span>
              <span className="text-[14px] tabular-nums num font-semibold text-[var(--brand-2)]">
                {fmtMoney(totalIncome)}
              </span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-[13px] text-[var(--text2)]">Gastos</span>
              <span className="text-[14px] tabular-nums num font-semibold text-[var(--text)]">
                {fmtMoney(totalExpenses)}
              </span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-[13px] text-[var(--text2)]">Disponible para asignar</span>
              <span
                className={`text-[14px] tabular-nums num font-semibold ${
                  readyToAssign > 0.005 ? 'gradient-text' : 'text-[var(--text2)]'
                }`}
              >
                {fmtMoney(readyToAssign)}
              </span>
            </li>
          </ul>
        </section>

        {/* Donut */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">Progreso del plan</h2>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">% gastado de lo asignado</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <DonutChart value={totalExpenses} total={totalAssigned} size={120} stroke={12} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[18px] font-bold tabular-nums num">
                    {totalAssigned > 0
                      ? `${Math.round((totalExpenses / totalAssigned) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-[12px]">
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Asignado</span>
                <span className="num tabular-nums text-[var(--text)]">
                  {fmtMoneyShort(totalAssigned)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Gastado</span>
                <span className="num tabular-nums text-[var(--coral)]">
                  {fmtMoneyShort(totalExpenses)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Restante</span>
                <span className="num tabular-nums text-[var(--brand-2)] font-semibold">
                  {fmtMoneyShort(Math.max(0, totalAssigned - totalExpenses))}
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Real-data insights replace the old single-message placeholder. */}
        <InsightsSection inputs={insightInputs} />

        {/* 14-day cash-flow forecast from scheduled transactions. */}
        <UpcomingCommitments
          items={upcomingItems}
          projectedCash={projectedCash}
          netFlow={upcomingNetFlow}
        />

        {/* Metas preview */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} strokeWidth={2.2} className="text-[var(--brand-2)]" />
              <h2 className="text-[14px] font-semibold text-[var(--text)]">Metas</h2>
            </div>
            {goals.length > 0 && (
              <Link
                href="/app/metas"
                className="text-[12px] text-[var(--brand-2)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Todas <ArrowRight size={12} strokeWidth={2.4} />
              </Link>
            )}
          </header>

          {goals.length === 0 ? (
            <div className="px-5 py-6 text-center space-y-3">
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                Aún no tienes metas. Define cuánto quieres apartar mensualmente o
                acumular en total para mantener el rumbo.
              </p>
              <Link
                href="/app/metas"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg gradient-bg text-[#0B0B0C] font-semibold text-[12px] glow-on-hover hover:brightness-105 transition-[filter]"
              >
                <Target size={12} strokeWidth={2.4} />
                Crear meta
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {goals.map((g) => {
                const isComplete = g.current >= g.goal - 0.005
                return (
                  <li key={g.id} className="px-5 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-[var(--text)] truncate">{g.name}</span>
                      <span
                        className={`text-[11px] tabular-nums num shrink-0 ${
                          isComplete ? 'text-[var(--brand-2)] font-semibold' : 'text-[var(--muted)]'
                        }`}
                      >
                        {Math.round(g.progress * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className="h-full gradient-bg transition-[width] duration-500"
                        style={{ width: `${g.progress * 100}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[var(--muted)] num tabular-nums flex items-center justify-between gap-2">
                      <span>
                        {fmtMoneyShort(g.current)} de {fmtMoneyShort(g.goal)}
                      </span>
                      <span className="text-[var(--muted2)]">
                        {g.goalType === 'savings_balance' ? 'Acumulada' : 'Mensual'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: number
  Icon: LucideIcon
  iconBg: string
  iconColor: string
  sublabel: string
  href?: string
  fmtMoney: (n: number) => string
}

function KpiCard({
  label,
  value,
  Icon,
  iconBg,
  iconColor,
  sublabel,
  href,
  fmtMoney,
}: KpiCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[18px] sm:text-[22px] font-bold tabular-nums num text-[var(--text)] leading-none break-words">
        {fmtMoney(value)}
      </div>
      <div className="text-[10px] sm:text-[11px] text-[var(--muted2)] mt-1.5 sm:mt-2">{sublabel}</div>
    </>
  )

  const className =
    'rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 sm:p-5 transition-all duration-200 hover:border-[var(--border3)] hover:-translate-y-[1px]'

  return href ? (
    <Link href={href} className={`block ${className}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}
