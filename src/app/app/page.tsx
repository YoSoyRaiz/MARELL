import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  PiggyBank,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { expandToCategoryContributions } from '@/lib/splits'
import {
  formatMoney as fmtMoneyWithCurrency,
  formatMoneyShort as fmtMoneyShortWithCurrency,
  parseCurrency,
} from '@/lib/money'
import { DonutChart } from './DonutChart'
import { CategoryCardsSection, type SectionGroup } from './CategoryCardsSection'
import { RecentTransactionsSection, type RecentTxn } from './RecentTransactionsSection'
import { materializeDue } from './programadas/actions'

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
  await materializeDue(budget.id as string)

  const currency = parseCurrency(budget.currency as string | null)
  const fmtMoney = (n: number) => fmtMoneyWithCurrency(n, currency)
  const fmtMoneyShort = (n: number) => fmtMoneyShortWithCurrency(n, currency)

  const month = currentMonth()
  const { first, last } = monthBounds(month)

  const [groupsRes, catsRes, accountsRes, assignmentsRes, txnsMonthRes, txnsRecentRes] =
    await Promise.all([
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
        .select('id, name, type, balance, closed')
        .eq('budget_id', budget.id)
        .order('sort_order'),
      supabase
        .from('monthly_assignments')
        .select('category_id, assigned')
        .eq('budget_id', budget.id)
        .eq('month', month),
      // Full month — drives totals (income / expense) and per-category activity.
      supabase
        .from('transactions')
        .select(
          'date, category_id, amount, is_split, transfer_account_id, subtransactions(category_id, amount)',
        )
        .eq('budget_id', budget.id)
        .gte('date', first)
        .lte('date', last),
      // Just the 5 most recent for the "Transacciones recientes" widget.
      supabase
        .from('transactions')
        .select('id, date, payee_name, category_id, amount')
        .eq('budget_id', budget.id)
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false })
        .limit(5),
    ])

  const groupsData = groupsRes.data ?? []
  const catsData = catsRes.data ?? []
  const accountsData = accountsRes.data ?? []
  const assignmentsData = assignmentsRes.data ?? []
  const txnsMonthData = txnsMonthRes.data ?? []
  const txnsRecentData = txnsRecentRes.data ?? []

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

  const totalCash = accountsData
    .filter((a) => cashTypes.includes(a.type as string))
    .reduce((s, a) => s + Number(a.balance), 0)
  const totalSavings = accountsData
    .filter((a) => a.type === 'savings')
    .reduce((s, a) => s + Number(a.balance), 0)
  const totalDebt = accountsData
    .filter((a) => debtTypes.includes(a.type as string))
    .reduce((s, a) => s + Math.abs(Number(a.balance)), 0)
  const totalInvestments = accountsData
    .filter((a) => investmentTypes.includes(a.type as string))
    .reduce((s, a) => s + Number(a.balance), 0)

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
  const readyToAssign = totalCash - totalAssigned

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

  // Per-group + per-category breakdown for the categorías cards (used by the modal)
  const sectionGroups: SectionGroup[] = groupsData.map((g) => {
    const groupCats = catsData.filter((c) => c.group_id === g.id)
    const categories = groupCats.map((c) => {
      const a = assignmentsData.find((x) => x.category_id === c.id)
      const activity = txnContributions
        .filter((t) => t.category_id === c.id)
        .reduce((s, t) => s + t.amount, 0)
      return {
        id: c.id as string,
        name: c.name as string,
        assigned: Number(a?.assigned ?? 0),
        activity,
        goal_amount: c.goal_amount === null ? null : Number(c.goal_amount),
      }
    })
    const assigned = categories.reduce((s, c) => s + c.assigned, 0)
    const spent = categories
      .filter((c) => c.activity < 0)
      .reduce((s, c) => s + Math.abs(c.activity), 0)
    return {
      id: g.id as string,
      name: g.name as string,
      categories,
      assigned,
      spent,
    }
  })

  // ── Goals preview (up to 4) ────────────────────────────────
  // Mirrors the calculation on /app/metas: monthly_spending uses the current
  // month's assignment, savings_balance uses lifetime (assigned − spent).
  type GoalType = 'monthly_spending' | 'savings_balance'

  const goalCats = catsData.filter(
    (c) => c.goal_amount !== null && Number(c.goal_amount) > 0,
  )
  const savingsGoalIds = goalCats
    .filter((c) => (c.goal_type as string | null) === 'savings_balance')
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
      const goalType: GoalType =
        (c.goal_type as string) === 'savings_balance' ? 'savings_balance' : 'monthly_spending'
      const goal = Number(c.goal_amount ?? 0)
      let current = 0
      if (goalType === 'savings_balance') {
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

        {/* Smart insight (placeholder) */}
        <section className="rounded-2xl gradient-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-[#0B0B0C]">
              <Sparkles size={14} strokeWidth={2.4} />
            </div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold">
              Idea inteligente
            </div>
          </div>
          <p className="text-[13px] text-[var(--text)] leading-relaxed">
            {totalAssigned === 0
              ? 'Tu plan está creado. Asigna tu primer peso desde el botón "Asignar dinero" en la barra superior.'
              : readyToAssign > 0.005
                ? `Tienes ${fmtMoneyShort(readyToAssign)} sin asignar. Cada peso con destino te acerca a tu meta.`
                : '¡Plan completo! Cada peso tiene su trabajo. Cuando agregues transacciones, vamos a marcarte el progreso aquí.'}
          </p>
        </section>

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
