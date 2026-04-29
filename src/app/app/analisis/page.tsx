import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalisisShell, type ReportKey } from './AnalisisShell'
import { AnalisisClient, type CategoryRow, type Period } from './AnalisisClient'
import {
  IncomeVsExpenseReport,
  type Range,
  type MonthAggregate,
} from './IncomeVsExpenseReport'

const todayLocal = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const formatISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const MONTH_NAMES_FULL = [
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

const MONTH_NAMES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

// ── Period helpers (Spending Breakdown) ─────────────────────

interface PeriodRange {
  first: string | null
  last: string | null
  label: string
}

const computePeriod = (period: Period): PeriodRange => {
  const today = todayLocal()
  const y = today.getFullYear()
  const m = today.getMonth()

  switch (period) {
    case 'month': {
      const first = new Date(y, m, 1)
      const last = new Date(y, m + 1, 0)
      return {
        first: formatISODate(first),
        last: formatISODate(last),
        label: `${MONTH_NAMES_FULL[m]} ${y}`,
      }
    }
    case 'last_month': {
      const first = new Date(y, m - 1, 1)
      const last = new Date(y, m, 0)
      return {
        first: formatISODate(first),
        last: formatISODate(last),
        label: `${MONTH_NAMES_FULL[first.getMonth()]} ${first.getFullYear()}`,
      }
    }
    case 'three_months': {
      const first = new Date(y, m - 2, 1)
      const last = new Date(y, m + 1, 0)
      return {
        first: formatISODate(first),
        last: formatISODate(last),
        label: `Últimos 3 meses`,
      }
    }
    case 'year': {
      const first = new Date(y, 0, 1)
      const last = new Date(y, 11, 31)
      return {
        first: formatISODate(first),
        last: formatISODate(last),
        label: `Año ${y}`,
      }
    }
    case 'all':
      return { first: null, last: null, label: 'Todas las fechas' }
  }
}

const parsePeriod = (raw: string | undefined): Period => {
  if (raw === 'last_month' || raw === 'three_months' || raw === 'year' || raw === 'all') {
    return raw
  }
  return 'month'
}

// ── Range helpers (Income vs Expense) ───────────────────────

const parseRange = (raw: string | undefined): Range => {
  if (raw === 'six_months' || raw === 'twenty_four_months' || raw === 'all') return raw
  return 'twelve_months'
}

const rangeToMonthCount: Record<Range, number | null> = {
  six_months: 6,
  twelve_months: 12,
  twenty_four_months: 24,
  all: null,
}

const rangeLabel = (range: Range): string => {
  switch (range) {
    case 'six_months':
      return 'Últimos 6 meses'
    case 'twelve_months':
      return 'Últimos 12 meses'
    case 'twenty_four_months':
      return 'Últimos 24 meses'
    case 'all':
      return 'Histórico completo'
  }
}

// ── Report dispatch ─────────────────────────────────────────

const parseReport = (raw: string | undefined): ReportKey => {
  if (
    raw === 'income_expense' ||
    raw === 'trends' ||
    raw === 'networth' ||
    raw === 'age_of_money'
  ) {
    return raw
  }
  return 'breakdown'
}

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; period?: string; range?: string }>
}) {
  const params = await searchParams
  const report = parseReport(params.report)

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
    return (
      <AnalisisShell active={report}>
        {report === 'income_expense' ? (
          <IncomeVsExpenseReport
            range="twelve_months"
            rangeLabel={rangeLabel('twelve_months')}
            months={[]}
            totalIncome={0}
            totalExpense={0}
            hasBudget={false}
            hasData={false}
          />
        ) : (
          <AnalisisClient
            period="month"
            totalIncome={0}
            totalExpenses={0}
            categoryRows={[]}
            uncategorizedExpense={0}
            hasBudget={false}
            hasData={false}
            periodLabel={computePeriod('month').label}
          />
        )}
      </AnalisisShell>
    )
  }

  // ── Spending Breakdown (default) ──────────────────────────
  if (report === 'breakdown') {
    const period = parsePeriod(params.period)
    const range = computePeriod(period)

    let txnsQuery = supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('budget_id', budget.id)

    if (range.first) txnsQuery = txnsQuery.gte('date', range.first)
    if (range.last) txnsQuery = txnsQuery.lte('date', range.last)

    const [txnsRes, catsRes] = await Promise.all([
      txnsQuery,
      supabase.from('categories').select('id, name').eq('budget_id', budget.id),
    ])

    const txns = txnsRes.data ?? []
    const cats = catsRes.data ?? []

    const categoryNameById = new Map(cats.map((c) => [c.id as string, c.name as string]))

    let totalIncome = 0
    let totalExpenses = 0
    const expensesByCategory = new Map<string, number>()
    let uncategorized = 0

    for (const t of txns) {
      const amount = Number(t.amount)
      if (amount > 0) {
        totalIncome += amount
      } else if (amount < 0) {
        const abs = Math.abs(amount)
        totalExpenses += abs
        const catId = (t.category_id as string | null) ?? null
        if (catId && categoryNameById.has(catId)) {
          expensesByCategory.set(catId, (expensesByCategory.get(catId) ?? 0) + abs)
        } else {
          uncategorized += abs
        }
      }
    }

    const categoryRows: CategoryRow[] = Array.from(expensesByCategory.entries())
      .map(([id, amount]) => ({
        id,
        name: categoryNameById.get(id) ?? '—',
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount)

    return (
      <AnalisisShell active="breakdown">
        <AnalisisClient
          period={period}
          totalIncome={Math.round(totalIncome * 100) / 100}
          totalExpenses={Math.round(totalExpenses * 100) / 100}
          categoryRows={categoryRows}
          uncategorizedExpense={Math.round(uncategorized * 100) / 100}
          hasBudget={true}
          hasData={txns.length > 0 && totalExpenses > 0.005}
          periodLabel={range.label}
        />
      </AnalisisShell>
    )
  }

  // ── Income vs Expense ─────────────────────────────────────
  if (report === 'income_expense') {
    const range = parseRange(params.range)
    const today = todayLocal()
    const monthCount = rangeToMonthCount[range]

    let firstISO: string | null = null
    if (monthCount !== null) {
      const first = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1), 1)
      firstISO = formatISODate(first)
    }

    let txnsQuery = supabase
      .from('transactions')
      .select('date, amount')
      .eq('budget_id', budget.id)

    if (firstISO) txnsQuery = txnsQuery.gte('date', firstISO)

    const { data: txns } = await txnsQuery

    // Aggregate per YYYY-MM
    const byMonth = new Map<string, { income: number; expense: number }>()
    for (const t of txns ?? []) {
      const date = (t.date as string).slice(0, 7) // YYYY-MM
      const amount = Number(t.amount)
      const cur = byMonth.get(date) ?? { income: 0, expense: 0 }
      if (amount > 0) cur.income += amount
      else if (amount < 0) cur.expense += Math.abs(amount)
      byMonth.set(date, cur)
    }

    // Build the canonical sequence of months in range
    const months: MonthAggregate[] = []
    if (monthCount !== null) {
      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const agg = byMonth.get(key) ?? { income: 0, expense: 0 }
        months.push({
          month: key,
          label: MONTH_NAMES_SHORT[d.getMonth()],
          income: Math.round(agg.income * 100) / 100,
          expense: Math.round(agg.expense * 100) / 100,
        })
      }
    } else {
      // 'all' — sequence from earliest data month to current
      if (byMonth.size === 0) {
        // no data; just the current month
        const d = today
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push({
          month: key,
          label: MONTH_NAMES_SHORT[d.getMonth()],
          income: 0,
          expense: 0,
        })
      } else {
        const keys = Array.from(byMonth.keys()).sort()
        const [fy, fm] = keys[0].split('-').map(Number)
        const start = new Date(fy, fm - 1, 1)
        const cur = new Date(start)
        while (
          cur.getFullYear() < today.getFullYear() ||
          (cur.getFullYear() === today.getFullYear() && cur.getMonth() <= today.getMonth())
        ) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
          const agg = byMonth.get(key) ?? { income: 0, expense: 0 }
          months.push({
            month: key,
            label: MONTH_NAMES_SHORT[cur.getMonth()],
            income: Math.round(agg.income * 100) / 100,
            expense: Math.round(agg.expense * 100) / 100,
          })
          cur.setMonth(cur.getMonth() + 1)
        }
      }
    }

    const totalIncome = months.reduce((s, m) => s + m.income, 0)
    const totalExpense = months.reduce((s, m) => s + m.expense, 0)

    return (
      <AnalisisShell active="income_expense">
        <IncomeVsExpenseReport
          range={range}
          rangeLabel={rangeLabel(range)}
          months={months}
          totalIncome={Math.round(totalIncome * 100) / 100}
          totalExpense={Math.round(totalExpense * 100) / 100}
          hasBudget={true}
          hasData={(txns ?? []).length > 0 && (totalIncome > 0 || totalExpense > 0)}
        />
      </AnalisisShell>
    )
  }

  // Other reports are placeholders for now
  return (
    <AnalisisShell active={report}>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis
        </div>
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
          Próximamente.
        </h1>
        <p className="text-[var(--text2)] text-[14px] max-w-xl leading-relaxed">
          Estoy construyendo este reporte. Por ahora puedes explorar Gastos por categoría e
          Ingresos vs Gastos.
        </p>
      </div>
    </AnalisisShell>
  )
}
