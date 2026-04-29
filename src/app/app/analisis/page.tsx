import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { expandToCategoryContributions } from '@/lib/splits'
import { AnalisisShell, type ReportKey } from './AnalisisShell'
import { AnalisisClient, type CategoryRow, type Period } from './AnalisisClient'
import {
  IncomeVsExpenseReport,
  type Range,
  type MonthAggregate,
} from './IncomeVsExpenseReport'
import {
  SpendingTrendsReport,
  type TrendsRange,
  type TrendCategory,
  type TrendMonth,
} from './SpendingTrendsReport'
import {
  NetWorthReport,
  type NetWorthRange,
  type NetWorthPoint,
} from './NetWorthReport'
import {
  AgeOfMoneyReport,
  type AomRange,
  type AgeOfMoneyPoint,
} from './AgeOfMoneyReport'

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

// ── Range helpers (Trends) ──────────────────────────────────

const parseTrendsRange = (raw: string | undefined): TrendsRange => {
  if (raw === 'six_months' || raw === 'twenty_four_months') return raw
  return 'twelve_months'
}

const trendsRangeMonthCount: Record<TrendsRange, number> = {
  six_months: 6,
  twelve_months: 12,
  twenty_four_months: 24,
}

const trendsRangeLabel = (range: TrendsRange): string => {
  switch (range) {
    case 'six_months':
      return 'Últimos 6 meses'
    case 'twelve_months':
      return 'Últimos 12 meses'
    case 'twenty_four_months':
      return 'Últimos 24 meses'
  }
}

// ── Range helpers (Net Worth) ───────────────────────────────

const parseNetWorthRange = (raw: string | undefined): NetWorthRange => {
  if (raw === 'six_months' || raw === 'twenty_four_months') return raw
  return 'twelve_months'
}

const netWorthMonthCount: Record<NetWorthRange, number> = {
  six_months: 6,
  twelve_months: 12,
  twenty_four_months: 24,
}

const netWorthRangeLabel = (range: NetWorthRange): string => {
  switch (range) {
    case 'six_months':
      return 'Últimos 6 meses'
    case 'twelve_months':
      return 'Últimos 12 meses'
    case 'twenty_four_months':
      return 'Últimos 24 meses'
  }
}

// ── Range helpers (Age of Money) ────────────────────────────

const parseAomRange = (raw: string | undefined): AomRange => {
  if (raw === 'six_months' || raw === 'twenty_four_months') return raw
  return 'twelve_months'
}

const aomMonthCount: Record<AomRange, number> = {
  six_months: 6,
  twelve_months: 12,
  twenty_four_months: 24,
}

const aomRangeLabel = (range: AomRange): string => {
  switch (range) {
    case 'six_months':
      return 'Últimos 6 meses'
    case 'twelve_months':
      return 'Últimos 12 meses'
    case 'twenty_four_months':
      return 'Últimos 24 meses'
  }
}

const daysBetween = (a: string, b: string): number => {
  // YYYY-MM-DD strings; treat as UTC midnight to avoid DST quirks
  const t1 = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10)),
  )
  const t2 = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10)),
  )
  return Math.max(0, Math.floor((t2 - t1) / (1000 * 60 * 60 * 24)))
}

const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const DEBT_TYPES_SET = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

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
      .select(
        'id, date, category_id, amount, is_split, subtransactions(category_id, amount)',
      )
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

    // Income / total expense use parent totals (a split touches multiple
    // categories but contributes a single signed amount to the cash flow).
    let totalIncome = 0
    let totalExpenses = 0
    for (const t of txns) {
      const amount = Number(t.amount)
      if (amount > 0) totalIncome += amount
      else if (amount < 0) totalExpenses += Math.abs(amount)
    }

    // Per-category expenses must use the split children when present.
    const expensesByCategory = new Map<string, number>()
    let uncategorized = 0
    for (const c of expandToCategoryContributions(txns)) {
      if (c.amount >= 0) continue
      const abs = Math.abs(c.amount)
      const catId = c.category_id
      if (catId && categoryNameById.has(catId)) {
        expensesByCategory.set(catId, (expensesByCategory.get(catId) ?? 0) + abs)
      } else {
        uncategorized += abs
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

  // ── Spending Trends ───────────────────────────────────────
  if (report === 'trends') {
    const trendsRange = parseTrendsRange(params.range)
    const monthCount = trendsRangeMonthCount[trendsRange]
    const today = todayLocal()

    const first = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1), 1)
    const firstISO = formatISODate(first)

    const [txnsRes, catsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select(
          'id, date, category_id, amount, is_split, subtransactions(category_id, amount)',
        )
        .eq('budget_id', budget.id)
        .gte('date', firstISO)
        // Pull the universe of in-range transactions; we filter to expense
        // contributions in JS so split children that are negative still count
        // even when the parent might be a different sign for transfers.
        .lt('amount', 0),
      supabase.from('categories').select('id, name').eq('budget_id', budget.id),
    ])

    const txns = txnsRes.data ?? []
    const cats = catsRes.data ?? []
    const categoryNameById = new Map(cats.map((c) => [c.id as string, c.name as string]))

    // Build per-category, per-month aggregation.
    // shape: Map<categoryId, Map<YYYY-MM, total>>
    const totalsByCat = new Map<string, Map<string, number>>()
    const overallByCat = new Map<string, number>()

    for (const c of expandToCategoryContributions(txns)) {
      if (c.amount >= 0) continue
      const catId = c.category_id
      if (!catId || !categoryNameById.has(catId)) continue
      const month = c.date.slice(0, 7)
      const abs = Math.abs(c.amount)
      let mp = totalsByCat.get(catId)
      if (!mp) {
        mp = new Map<string, number>()
        totalsByCat.set(catId, mp)
      }
      mp.set(month, (mp.get(month) ?? 0) + abs)
      overallByCat.set(catId, (overallByCat.get(catId) ?? 0) + abs)
    }

    // Top 5 categories by total spending in range
    const topIds = Array.from(overallByCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    // Build month sequence
    const months: TrendMonth[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_NAMES_SHORT[d.getMonth()],
      })
    }

    const categoriesPayload: TrendCategory[] = topIds.map((id) => {
      const monthMap = totalsByCat.get(id) ?? new Map<string, number>()
      const values = months.map(
        (m) => Math.round((monthMap.get(m.month) ?? 0) * 100) / 100,
      )
      return {
        id,
        name: categoryNameById.get(id) ?? '—',
        total: Math.round((overallByCat.get(id) ?? 0) * 100) / 100,
        values,
      }
    })

    return (
      <AnalisisShell active="trends">
        <SpendingTrendsReport
          range={trendsRange}
          rangeLabel={trendsRangeLabel(trendsRange)}
          months={months}
          categories={categoriesPayload}
          hasBudget={true}
          hasData={categoriesPayload.length > 0}
        />
      </AnalisisShell>
    )
  }

  // ── Net Worth ─────────────────────────────────────────────
  if (report === 'networth') {
    const nwRange = parseNetWorthRange(params.range)
    const monthCount = netWorthMonthCount[nwRange]
    const today = todayLocal()

    const [accountsRes, txnsRes] = await Promise.all([
      supabase.from('accounts').select('id, type, balance').eq('budget_id', budget.id),
      supabase
        .from('transactions')
        .select('date, account_id, amount')
        .eq('budget_id', budget.id),
    ])

    const accounts = accountsRes.data ?? []
    const txns = txnsRes.data ?? []

    // Group transactions by account_id for fast lookup
    const txnsByAccount = new Map<string, Array<{ date: string; amount: number }>>()
    for (const t of txns) {
      const id = t.account_id as string
      const arr = txnsByAccount.get(id) ?? []
      arr.push({ date: t.date as string, amount: Number(t.amount) })
      txnsByAccount.set(id, arr)
    }

    // Build monthly series (oldest → newest)
    const series: NetWorthPoint[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const monthFirst = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthLast = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0)
      const cutoffDate = monthLast > today ? today : monthLast
      const cutoffISO = formatISODate(cutoffDate)

      let netWorth = 0
      for (const acc of accounts) {
        const accTxns = txnsByAccount.get(acc.id as string) ?? []
        const futureSum = accTxns
          .filter((t) => t.date > cutoffISO)
          .reduce((s, t) => s + t.amount, 0)
        const reconstructed = Number(acc.balance) - futureSum
        // Cast type to string — generated Supabase types lag behind the
        // schema's CHECK constraint expansion (see cuentas/actions.ts note).
        if ((acc.type as string) === 'liability') {
          netWorth -= reconstructed
        } else {
          netWorth += reconstructed
        }
      }

      series.push({
        month: `${monthFirst.getFullYear()}-${String(monthFirst.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_NAMES_SHORT[monthFirst.getMonth()],
        value: Math.round(netWorth * 100) / 100,
      })
    }

    // Current snapshot for KPIs
    let totalCash = 0
    let totalAssets = 0
    let totalDebts = 0
    for (const acc of accounts) {
      const balance = Number(acc.balance)
      const type = acc.type as string
      if (CASH_TYPES.has(type)) {
        totalCash += balance
      } else if (type === 'asset') {
        totalAssets += balance
      } else if (type === 'liability') {
        totalDebts += balance // stored positive but counts as debt
      } else if (DEBT_TYPES_SET.has(type)) {
        totalDebts += Math.abs(balance) // stored negative
      }
    }

    return (
      <AnalisisShell active="networth">
        <NetWorthReport
          range={nwRange}
          rangeLabel={netWorthRangeLabel(nwRange)}
          series={series}
          totalCash={Math.round(totalCash * 100) / 100}
          totalAssets={Math.round(totalAssets * 100) / 100}
          totalDebts={Math.round(totalDebts * 100) / 100}
          hasBudget={true}
          hasData={accounts.length > 0}
        />
      </AnalisisShell>
    )
  }

  // ── Age of Money (FIFO) ───────────────────────────────────
  if (report === 'age_of_money') {
    const aomRange = parseAomRange(params.range)
    const monthCount = aomMonthCount[aomRange]
    const today = todayLocal()

    // FIFO needs the full transaction history to build the lot queue correctly.
    const { data: txns } = await supabase
      .from('transactions')
      .select('date, amount')
      .eq('budget_id', budget.id)
      .order('date', { ascending: true })

    type Lot = { date: string; remaining: number }
    const lots: Lot[] = []
    const monthly = new Map<string, { spent: number; weightedAge: number }>()

    for (const t of txns ?? []) {
      const amount = Number(t.amount)
      const date = t.date as string
      if (amount > 0) {
        lots.push({ date, remaining: amount })
      } else if (amount < 0) {
        let toSpend = Math.abs(amount)
        while (toSpend > 0.005 && lots.length > 0) {
          const oldest = lots[0]
          const consume = Math.min(oldest.remaining, toSpend)
          const age = daysBetween(oldest.date, date)
          const monthKey = date.slice(0, 7)
          const m = monthly.get(monthKey) ?? { spent: 0, weightedAge: 0 }
          m.spent += consume
          m.weightedAge += consume * age
          monthly.set(monthKey, m)
          oldest.remaining -= consume
          toSpend -= consume
          if (oldest.remaining < 0.005) lots.shift()
        }
        // If toSpend > 0, we have a deficit (spent more than ever received).
        // Ignore the leftover — it doesn't have an income to anchor its age.
      }
    }

    // Build month sequence for the requested range
    const series: AgeOfMoneyPoint[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m = monthly.get(monthKey)
      const ageDays = m && m.spent > 0.005 ? m.weightedAge / m.spent : null
      series.push({
        month: monthKey,
        label: MONTH_NAMES_SHORT[d.getMonth()],
        ageDays: ageDays === null ? null : Math.round(ageDays * 10) / 10,
      })
    }

    return (
      <AnalisisShell active="age_of_money">
        <AgeOfMoneyReport
          range={aomRange}
          rangeLabel={aomRangeLabel(aomRange)}
          series={series}
          hasBudget={true}
          hasData={series.some((p) => p.ageDays !== null)}
        />
      </AnalisisShell>
    )
  }

  // Catch-all (shouldn't happen — all 5 reports are wired)
  return (
    <AnalisisShell active={report}>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis
        </div>
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
          Próximamente.
        </h1>
      </div>
    </AnalisisShell>
  )
}
