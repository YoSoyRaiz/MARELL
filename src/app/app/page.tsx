import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  PiggyBank,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ResetOnboardingButton } from './ResetOnboardingButton'
import { DonutChart } from './DonutChart'
import { CategoryCardsSection, type SectionGroup } from './CategoryCardsSection'
import { RecentTransactionsSection, type RecentTxn } from './RecentTransactionsSection'
import { materializeDue } from './programadas/actions'

const fmtMoney = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (n < -0.005) return `−$${formatted}`
  return `$${formatted}`
}

const fmtMoneyShort = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n < -0.005) return `−$${formatted}`
  return `$${formatted}`
}

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
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
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

  const month = currentMonth()
  const { first, last } = monthBounds(month)

  const [groupsRes, catsRes, accountsRes, assignmentsRes, txnsRes] = await Promise.all([
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, group_id, goal_amount')
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
  const txnsData = txnsRes.data ?? []

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

  const totalIncome = txnsData
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = txnsData
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

  const recentTxns: RecentTxn[] = txnsData.map((t) => ({
    id: t.id as string,
    date: t.date as string,
    payee_name: (t.payee_name as string | null) ?? null,
    category_name: t.category_id
      ? (catsData.find((c) => c.id === t.category_id)?.name as string | undefined) ?? null
      : null,
    amount: Number(t.amount),
  }))

  // Per-group + per-category breakdown for the categorías cards (used by the modal)
  const sectionGroups: SectionGroup[] = groupsData.map((g) => {
    const groupCats = catsData.filter((c) => c.group_id === g.id)
    const categories = groupCats.map((c) => {
      const a = assignmentsData.find((x) => x.category_id === c.id)
      const activity = txnsData
        .filter((t) => t.category_id === c.id)
        .reduce((s, t) => s + Number(t.amount), 0)
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

  // Goals preview (up to 4)
  const goals = catsData
    .filter((c) => c.goal_amount && Number(c.goal_amount) > 0)
    .map((c) => {
      const a = assignmentsData.find((x) => x.category_id === c.id)
      const assigned = Number(a?.assigned ?? 0)
      const goal = Number(c.goal_amount ?? 0)
      return {
        id: c.id as string,
        name: c.name as string,
        assigned,
        goal,
        progress: goal > 0 ? Math.min(1, assigned / goal) : 0,
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
          <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
            Tu mes en una <span className="gradient-text">mirada</span>, {firstName}.
          </h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Ingresos"
            value={totalIncome}
            Icon={TrendingUp}
            iconBg="bg-[rgba(61,220,151,0.10)]"
            iconColor="text-[var(--brand-2)]"
            sublabel="Este mes"
          />
          <KpiCard
            label="Gastos"
            value={totalExpenses}
            Icon={TrendingDown}
            iconBg="bg-[rgba(255,122,89,0.10)]"
            iconColor="text-[var(--coral)]"
            sublabel="Este mes"
            href="/app/plan"
          />
          <KpiCard
            label="Ahorros"
            value={totalSavings}
            Icon={PiggyBank}
            iconBg="bg-[rgba(77,168,255,0.10)]"
            iconColor="text-[var(--info)]"
            sublabel="Cuentas de ahorro"
          />
          <KpiCard
            label="Patrimonio neto"
            value={netWorth}
            Icon={Wallet}
            iconBg="bg-[rgba(245,200,66,0.10)]"
            iconColor="text-[var(--warn)]"
            sublabel="Activos − deudas"
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

        {/* Reset onboarding (subtle, footer) */}
        <div className="pt-4 flex items-center justify-end">
          <ResetOnboardingButton />
        </div>
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
        {goals.length > 0 && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
            <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[var(--text)]">Metas</h2>
              <Link
                href="/app/metas"
                className="text-[12px] text-[var(--brand-2)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Todas <ArrowRight size={12} strokeWidth={2.4} />
              </Link>
            </header>
            <ul className="divide-y divide-[var(--border)]">
              {goals.map((g) => (
                <li key={g.id} className="px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-[var(--text)] truncate">{g.name}</span>
                    <span className="text-[11px] text-[var(--muted)] tabular-nums num shrink-0">
                      {Math.round(g.progress * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full gradient-bg transition-[width] duration-500"
                      style={{ width: `${g.progress * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[var(--muted)] num tabular-nums">
                    {fmtMoneyShort(g.assigned)} de {fmtMoneyShort(g.goal)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
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
}

function KpiCard({ label, value, Icon, iconBg, iconColor, sublabel, href }: KpiCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[22px] font-bold tabular-nums num text-[var(--text)] leading-none">
        {fmtMoney(value)}
      </div>
      <div className="text-[11px] text-[var(--muted2)] mt-2">{sublabel}</div>
    </>
  )

  const className =
    'rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 transition-all duration-200 hover:border-[var(--border3)] hover:-translate-y-[1px]'

  return href ? (
    <Link href={href} className={`block ${className}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}
