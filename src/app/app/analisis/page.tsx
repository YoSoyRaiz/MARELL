import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalisisClient, type CategoryRow, type Period } from './AnalisisClient'

const todayLocal = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const formatISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

interface PeriodRange {
  first: string | null // null means no lower bound (= 'all')
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
        label: `${MONTH_NAMES[m]} ${y}`,
      }
    }
    case 'last_month': {
      const first = new Date(y, m - 1, 1)
      const last = new Date(y, m, 0)
      return {
        first: formatISODate(first),
        last: formatISODate(last),
        label: `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`,
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

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const period = parsePeriod(params.period)

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
      <AnalisisClient
        period={period}
        totalIncome={0}
        totalExpenses={0}
        categoryRows={[]}
        uncategorizedExpense={0}
        hasBudget={false}
        hasData={false}
        periodLabel={computePeriod(period).label}
      />
    )
  }

  const range = computePeriod(period)

  let txnsQuery = supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('budget_id', budget.id)

  if (range.first) txnsQuery = txnsQuery.gte('date', range.first)
  if (range.last) txnsQuery = txnsQuery.lte('date', range.last)

  const [txnsRes, catsRes] = await Promise.all([
    txnsQuery,
    supabase
      .from('categories')
      .select('id, name')
      .eq('budget_id', budget.id),
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
  )
}
