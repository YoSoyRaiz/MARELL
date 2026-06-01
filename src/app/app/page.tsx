import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Target } from 'lucide-react'
import { AddTransactionButton } from './AddTransactionButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { expandToCategoryContributions } from '@/lib/splits'
import {
  formatMoney as fmtMoneyWithCurrency,
  formatMoneyShort as fmtMoneyShortWithCurrency,
  parseCurrency,
  convertAmount,
  type Currency as MoneyCurrency,
} from '@/lib/money'
import { DonutChart } from './DonutChart'
import { type SectionGroup } from './CategoryCardsSection'
import { RecentTransactionsSection, type RecentTxn } from './RecentTransactionsSection'
import { InsightsSection, type InsightInputs } from './InsightsSection'
import { FirstMonthGuide } from './FirstMonthGuide'
import { CategoryAccordion } from './CategoryAccordion'
import { MonthSummaryCard } from './MonthSummaryCard'
import { MonthKpiCards } from './MonthKpiCards'
import {
  currentMonthDR,
  monthBoundsISO,
  todayISODR,
  formatMonthLabel,
} from '@/lib/dates'
import { UpcomingCommitments, type UpcomingItem } from './UpcomingCommitments'

const currentMonth = currentMonthDR
const monthBounds = monthBoundsISO

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

  // Active budget — usuario puede tener varios (propios + compartidos
  // por familia o como auditor de clientes). El helper preserva
  // comportamiento single-budget si no hay cookie ni override.
  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = activeBudgetId
    ? await supabase
        .from('budgets')
        .select('id, name, currency, usd_to_dop_rate')
        .eq('id', activeBudgetId)
        .maybeSingle()
    : { data: null }

  if (!budget) {
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow="Resumen"
          description="Termina el onboarding para construir tu plan."
          descriptionSize="md"
        >
          Aún no tienes <span className="gradient-text">presupuesto</span>.
        </PageHeader>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body rounded-xl glow-on-hover hover:brightness-105 transition-[filter]"
        >
          Empezar onboarding <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    )
  }

  // Antes el dashboard llamaba a materializeDue() aquí en cada page-load,
  // escaneando scheduled_transactions y haciendo INSERTs en línea. Eso
  // movido al cron /api/cron/materialize-scheduled (corre 4:30 AM DR).
  // (Auditoría calidad L2.) El reflejo "inmediato" se sigue dando porque
  // la pantalla de Programadas mantiene el call directo cuando el usuario
  // entra a esa sección — el resto del tiempo el cron es suficiente.

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

  // Previous month label + bounds — drives the "Mes pasado" review card.
  const prevMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const prevBounds = monthBounds(prevMonth)

  // Window de 3 meses calendario (mes actual y los 2 anteriores) para
  // calcular el runway. Necesitamos un promedio mensual robusto de
  // gastos — un solo mes puede estar distorsionado por gastos one-off.
  const runwayWindow = (() => {
    const [y, m] = month.split('-').map(Number)
    const firstD = new Date(y, m - 3, 1) // 2 meses antes del actual
    return {
      first: `${firstD.getFullYear()}-${String(firstD.getMonth() + 1).padStart(2, '0')}-01`,
      // last = fin del mes actual ya lo tenemos en `last`
    }
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
    txnsPrevMonthRes,
    txnsRunwayRes,
  ] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, group_id, goal_amount, goal_type, goal_date')
      .eq('budget_id', budget.id)
      // Hidden categories shouldn't appear in the dashboard cards or
      // contribute to its totals — they're "archived" from the user's
      // perspective. The plan view already filters them; aligning here.
      .eq('hidden', false),
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
    // Incluye account_id + payee_name para que los KPIs hagan conversión
    // multi-currency y filtren saldos iniciales/ajustes (igual que
    // /app/analisis), garantizando congruencia entre las dos vistas.
    supabase
      .from('transactions')
      .select(
        'date, account_id, payee_name, category_id, amount, is_split, transfer_account_id, subtransactions(category_id, amount)',
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
    // Previous month's parent transactions — used by the "Mes pasado"
    // review card. We don't bother with subtransactions here; for the
    // review we want headline ingresos vs gastos, not per-category math.
    supabase
      .from('transactions')
      .select('amount, account_id, payee_name, category_id, transfer_account_id')
      .eq('budget_id', budget.id)
      .gte('date', prevBounds.first)
      .lte('date', prevBounds.last),
    // 3-month window de gastos para el cálculo de runway. Solo
    // necesitamos amount + account_id + flags de filtrado.
    supabase
      .from('transactions')
      .select('amount, account_id, payee_name, transfer_account_id, date')
      .eq('budget_id', budget.id)
      .gte('date', runwayWindow.first)
      .lte('date', last),
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
  // Closed accounts are user-archived — their balance shouldn't count
  // toward the dashboard's "this is what I have" totals. Without this
  // filter a long-closed checking account would inflate totalCash and
  // throw off Ready-to-Assign math derived from it.
  const isOpen = (a: { closed: boolean | null }) =>
    !(a.closed === true)

  const totalCash = accountsData
    .filter((a) => cashTypes.includes(a.type as string) && isOpen(a))
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )
  const totalSavings = accountsData
    .filter((a) => a.type === 'savings' && isOpen(a))
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )
  const totalDebt = accountsData
    .filter((a) => debtTypes.includes(a.type as string) && isOpen(a))
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
    .filter((a) => investmentTypes.includes(a.type as string) && isOpen(a))
    .reduce(
      (s, a) =>
        s + accountBalanceInBudget({ balance: Number(a.balance), currency: (a.currency as string | null) ?? null }),
      0,
    )

  const netWorth = totalCash + totalInvestments - totalDebt

  // Income / expense come from the *full* month. Excluímos:
  //   - Transfers (transfer_account_id no-null): solo mueven dinero
  //   - 'Saldo inicial' y 'Ajuste de reconciliación': no son flujos
  //     económicos reales — son contables/de sistema. Excluirlos
  //     evita que la creación de cuenta con balance ≠ 0 aparezca como
  //     "ingreso" del mes en KPIs y reportes.
  // Cada amount se convierte a la currency del budget antes de sumar
  // (multi-currency: USD checking + DOP checking no se mezclan crudo).
  // Esto garantiza congruencia con los reportes de /app/analisis.
  const SYSTEM_PAYEES_SET = new Set(['Saldo inicial', 'Ajuste de reconciliación'])
  const accountCurrencyById = new Map<string, MoneyCurrency>(
    accountsData.map((a) => [
      a.id as string,
      parseCurrency((a.currency as string | null) ?? null),
    ]),
  )
  const txnAmountInBudget = (t: { amount: number | string; account_id: string }) => {
    const accCcy = accountCurrencyById.get(t.account_id) ?? budgetMoneyCurrency
    return convertAmount(Number(t.amount), accCcy, budgetMoneyCurrency, fxRate)
  }
  const isFlowTxn = (t: {
    transfer_account_id?: string | null
    payee_name?: string | null
  }) =>
    !t.transfer_account_id && !SYSTEM_PAYEES_SET.has((t.payee_name ?? '') as string)

  const flowTxns = txnsMonthData.filter(isFlowTxn)
  const totalIncome = flowTxns
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + txnAmountInBudget({ amount: t.amount as number | string, account_id: t.account_id as string }), 0)
  const totalExpenses = flowTxns
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(txnAmountInBudget({ amount: t.amount as number | string, account_id: t.account_id as string })), 0)

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
  // Mismo filtro que /app/metas: solo cuenta metas reales de ahorro
  // (savings_balance / needed_by) y categorías del grupo "Metas".
  // Las metas monthly_spending son budget commitments, no metas — viven
  // en Plan, no aquí.
  type GoalType = 'monthly_spending' | 'savings_balance' | 'needed_by'

  const groupNameByIdForGoals = new Map<string, string>()
  for (const g of groupsData) {
    groupNameByIdForGoals.set(g.id as string, g.name as string)
  }
  const isMetasGroupCat = (c: { group_id: string | null }) =>
    groupNameByIdForGoals.get(c.group_id as string) === 'Metas'
  const SAVINGS_TYPES = new Set(['savings_balance', 'needed_by'])

  // El widget muestra barras de progreso, así que solo incluye metas
  // CON target configurado (goal_amount > 0). Metas en el grupo sin
  // amount aparecen como "Configurar meta" en /app/metas, no aquí —
  // un 0/0 en la dashboard sería confuso.
  const goalCats = catsData.filter((c) => {
    if (c.goal_amount === null || Number(c.goal_amount) <= 0) return false
    return isMetasGroupCat(c) || SAVINGS_TYPES.has(c.goal_type as string)
  })
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

  // ── Predictive insight: spending projection ────────────────
  // For each category with both an assignment and current spend, project
  // how much they're on pace to spend by month-end (linearly). If the
  // projection exceeds the assignment by 10%+, that's a "you're going
  // to overspend" signal — surfaced as the most actionable insight
  // because the user can still course-correct mid-month.
  const todayDate = new Date(today + 'T00:00:00')
  const daysElapsed = Math.max(1, todayDate.getDate())
  const totalDaysInMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  })()
  let projectedOverspend: {
    name: string
    assigned: number
    spent: number
    projected: number
  } | null = null
  for (const g of sectionGroups) {
    for (const c of g.categories) {
      if (c.assigned <= 0.005) continue
      const spent = c.activity < 0 ? Math.abs(c.activity) : 0
      if (spent <= 0.005) continue
      const projected = (spent / daysElapsed) * totalDaysInMonth
      if (projected <= c.assigned * 1.1) continue
      const overrun = projected - c.assigned
      if (
        !projectedOverspend ||
        overrun > projectedOverspend.projected - projectedOverspend.assigned
      ) {
        projectedOverspend = {
          name: c.name,
          assigned: c.assigned,
          spent,
          projected: Math.round(projected * 100) / 100,
        }
      }
    }
  }

  // Previous-month review numbers para la "Mes pasado" card. Aplica
  // mismos filtros que el mes actual (system payees fuera, multi-
  // currency convertido) para que las comparaciones sean apples-to-
  // apples.
  const prevMonthData = txnsPrevMonthRes.data ?? []
  const prevFlowTxns = prevMonthData.filter(isFlowTxn)
  const prevMonthIncome = prevFlowTxns
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + txnAmountInBudget({ amount: t.amount as number | string, account_id: t.account_id as string }), 0)
  const prevMonthExpenses = prevFlowTxns
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(txnAmountInBudget({ amount: t.amount as number | string, account_id: t.account_id as string })), 0)
  const prevMonthSavings = prevMonthIncome - prevMonthExpenses
  const prevMonthHadActivity = prevMonthData.length > 0

  // Runway: cuántos meses aguanta el cash actual al ritmo promedio de
  // gasto de los últimos 3 meses. Es la métrica más visceral del set —
  // responde "¿cuánto puedo vivir si paro de ganar mañana?" Excluye
  // transfers y system payees igual que el resto de KPIs.
  const runwayTxns = (txnsRunwayRes.data ?? []).filter(isFlowTxn)
  const runwayExpensesTotal = runwayTxns
    .filter((t) => Number(t.amount) < 0)
    .reduce(
      (s, t) =>
        s + Math.abs(txnAmountInBudget({ amount: t.amount as number | string, account_id: t.account_id as string })),
      0,
    )
  // Dividimos entre 3 (meses calendario). Si el rango cubre <3 meses
  // de data real (usuario nuevo), igualmente dividimos entre 3 — el
  // resultado es conservador (subestima el gasto), lo cual prefiero
  // sobre inflar el runway artificialmente.
  const avgMonthlyExpense = runwayExpensesTotal / 3
  const runwayMonths =
    avgMonthlyExpense > 0.005 ? totalCash / avgMonthlyExpense : null

  // Tasa de ahorro del mes actual. Si no hay ingresos, null (no tiene
  // sentido el ratio).
  const savingsRate =
    totalIncome > 0.005 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : null

  // Delta vs mes pasado para ingresos y gastos — la card lo muestra
  // como '+12%' / '−4%' bajo el número principal.
  const incomeDeltaPct =
    prevMonthIncome > 0.005
      ? ((totalIncome - prevMonthIncome) / prevMonthIncome) * 100
      : null
  const expenseDeltaPct =
    prevMonthExpenses > 0.005
      ? ((totalExpenses - prevMonthExpenses) / prevMonthExpenses) * 100
      : null

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

  // First-month guide flags. Cheap booleans derived from data we
  // already have, so no extra queries.
  const guideHasAssigned = totalAssigned > 0.005
  const guideHasTransaction =
    txnsRecentData.length > 0 || txnsMonthData.length > 0
  // Considera "tener metas" solo si hay savings/needed_by configurados
  // o categorías del grupo Metas — alineado con el resto de la UI.
  const guideHasGoal = catsData.some((c) => {
    if (isMetasGroupCat(c)) return true
    return (
      SAVINGS_TYPES.has(c.goal_type as string) &&
      c.goal_amount !== null &&
      Number(c.goal_amount) > 0
    )
  })
  // For "reconciled" we'd need to join transactions on cleared status.
  // Use a cheap proxy: if at least one transaction is marked reconciled
  // we count it. Cheap because txnsMonthData is already loaded — we
  // just don't have the cleared field in the SELECT.
  // Cheap existence check: HEAD-only query for any reconciled txn in
  // this budget. We don't care about counts, only whether the user
  // has ever finished a reconciliation.
  const { count: reconciledCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('budget_id', budget.id)
    .eq('cleared', 'reconciled')
  const guideHasReconciled = (reconciledCount ?? 0) > 0

  const insightInputs: InsightInputs = {
    readyToAssign,
    totalAssignedThisMonth: totalAssigned,
    overspentCount,
    undermetGoalsCount,
    topExpense: topExpenseEntry,
    closestGoal: closestGoalEntry,
    projectedOverspend,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* LEFT COLUMN */}
      <div className="space-y-7 min-w-0">
        {/* Greeting + CTA "Agregar transacción" — abre el modal en
            sitio (sin navegar a /transacciones) usando los mismos
            accounts/categories que ya alimentan el resto de la vista. */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <PageHeader eyebrow={`Resumen · ${formatMonthLabel(month)}`}>
              Tu mes en una <span className="gradient-text">mirada</span>, {firstName}.
            </PageHeader>
          </div>
          <div className="shrink-0">
            <AddTransactionButton
              accounts={modalAccounts}
              categories={modalCategories}
              variant="primary"
            />
          </div>
        </div>

        {/* First-month onboarding guide. Component self-hides once the
            user dismisses it via localStorage. */}
        <FirstMonthGuide
          hasAssigned={guideHasAssigned}
          hasTransaction={guideHasTransaction}
          hasGoal={guideHasGoal}
          hasReconciled={guideHasReconciled}
        />

        {/* 4 KPI cards de salud financiera del mes — recomendados por
            la auditoría 2026-05-27. Los números usan los MISMOS filtros
            y conversión multi-currency que los reportes de /analisis
            para que la lectura sea congruente entre vistas. */}
        <MonthKpiCards
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          savingsRate={savingsRate}
          runwayMonths={runwayMonths}
          incomeDeltaPct={incomeDeltaPct}
          expenseDeltaPct={expenseDeltaPct}
        />

        {/* Orden por feedback del usuario: primero Categorías
            (acordeón con scroll, primer grupo abierto), después
            Transacciones recientes. Antes el acordeón vivía en la
            columna derecha; ahora ocupa la posición principal porque
            es lo primero que el usuario quiere ver al entrar. */}
        <CategoryAccordion
          groups={sectionGroups}
          budgetId={budget.id as string}
          month={month}
          accounts={modalAccounts}
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

        {/* "Resumen de este mes" — primer card del rail derecho, según
            el mockup target. 4 rows: carry-over del mes pasado /
            Ingresos / Gastos / Disponible para asignar. Le da al user
            el state-of-the-month inmediato antes del donut. */}
        <MonthSummaryCard
          monthLabel={formatMonthLabel(month)}
          prevMonthNet={prevMonthSavings}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          totalAssigned={totalAssigned}
          fmtMoney={fmtMoney}
        />

        {/* 14-day cash-flow forecast — sube al 2do slot del rail
            derecho porque "qué viene esta semana" es la pregunta
            inmediata después del state-of-the-month. */}
        <UpcomingCommitments
          items={upcomingItems}
          projectedCash={projectedCash}
          netFlow={upcomingNetFlow}
        />

        {/* Donut */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-body font-semibold text-[var(--text)]">Progreso del plan</h2>
              <p className="text-eyebrow text-[var(--muted)] mt-0.5">% gastado de lo asignado</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <DonutChart value={totalExpenses} total={totalAssigned} size={120} stroke={12} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-h3 font-bold tabular-nums num">
                    {totalAssigned > 0
                      ? `${Math.round((totalExpenses / totalAssigned) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-meta">
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Asignado</span>
                <span className="num tabular-nums text-[var(--text)]">
                  {fmtMoneyShort(totalAssigned)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Gastado</span>
                <span className="num tabular-nums text-[var(--coral-text)]">
                  {fmtMoneyShort(totalExpenses)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--text2)]">Restante</span>
                <span className="num tabular-nums text-[var(--brand-text)] font-semibold">
                  {fmtMoneyShort(Math.max(0, totalAssigned - totalExpenses))}
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Real-data insights replace the old single-message placeholder. */}
        <InsightsSection inputs={insightInputs} />

        {/* Mes pasado review — quick reflection card. Hidden when there's
            no activity to summarize (fresh accounts, future months). */}
        {prevMonthHadActivity && (
          <Card as="section" className="overflow-hidden">
            <CardHeader>
              <h2 className="text-body font-semibold text-[var(--text)] truncate">
                Cierre de {formatMonthLabel(prevMonth)}
              </h2>
              <Link
                href="/app/analisis"
                className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0"
              >
                Ver análisis
                <ArrowRight size={12} strokeWidth={2.4} />
              </Link>
            </CardHeader>
            <ul className="divide-y divide-[var(--border)]">
              <li className="px-5 py-3 flex items-center justify-between">
                <span className="text-body-sm text-[var(--text2)]">Ingresos</span>
                <span className="text-body tabular-nums num font-semibold text-[var(--brand-text)]">
                  {fmtMoney(prevMonthIncome)}
                </span>
              </li>
              <li className="px-5 py-3 flex items-center justify-between">
                <span className="text-body-sm text-[var(--text2)]">Gastos</span>
                <span className="text-body tabular-nums num font-semibold text-[var(--text)]">
                  {fmtMoney(prevMonthExpenses)}
                </span>
              </li>
              <li className="px-5 py-3 flex items-center justify-between">
                <span className="text-body-sm text-[var(--text2)]">
                  {prevMonthSavings >= 0 ? 'Ahorrado' : 'Excedido'}
                </span>
                <span
                  className={`text-body tabular-nums num font-semibold ${
                    prevMonthSavings >= 0 ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
                  }`}
                >
                  {fmtMoney(Math.abs(prevMonthSavings))}
                </span>
              </li>
            </ul>
          </Card>
        )}

        {/* Metas preview */}
        <Card as="section" className="overflow-hidden">
          <CardHeader gap="none">
            <div className="flex items-center gap-2">
              <Target size={14} strokeWidth={2.2} className="text-[var(--brand-text)]" />
              <h2 className="text-body font-semibold text-[var(--text)]">Metas</h2>
            </div>
            {goals.length > 0 && (
              <Link
                href="/app/metas"
                className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Todas <ArrowRight size={12} strokeWidth={2.4} />
              </Link>
            )}
          </CardHeader>

          {goals.length === 0 ? (
            <div className="px-5 py-6 text-center space-y-3">
              <p className="text-body-sm text-[var(--muted)] leading-relaxed">
                Aún no tienes metas. Define cuánto quieres apartar mensualmente o
                acumular en total para mantener el rumbo.
              </p>
              <Link
                href="/app/metas"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg gradient-bg text-[#0B0B0C] font-semibold text-meta glow-on-hover hover:brightness-105 transition-[filter]"
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
                      <span className="text-body-sm text-[var(--text)] truncate">{g.name}</span>
                      <span
                        className={`text-eyebrow tabular-nums num shrink-0 ${
                          isComplete ? 'text-[var(--brand-text)] font-semibold' : 'text-[var(--muted)]'
                        }`}
                      >
                        {Math.round(g.progress * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--overlay-1)] overflow-hidden">
                      <div
                        className="h-full gradient-bg transition-[width] duration-500"
                        style={{ width: `${g.progress * 100}%` }}
                      />
                    </div>
                    <div className="text-eyebrow text-[var(--muted)] num tabular-nums flex items-center justify-between gap-2">
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
        </Card>
      </aside>
    </div>
  )
}

