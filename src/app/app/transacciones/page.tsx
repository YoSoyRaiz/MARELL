import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  TransactionsClient,
  type ListTransaction,
  type AccountOption,
  type CategoryOption,
  type FilterState,
} from './TransactionsClient'
import { currentMonthDR, monthBoundsISO } from '@/lib/dates'

const currentMonth = currentMonthDR
const monthBounds = monthBoundsISO

const isValidMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
const isValidYear = (s: string) => /^\d{4}$/.test(s)

const parseType = (raw: string | undefined): 'all' | 'income' | 'expense' => {
  if (raw === 'income' || raw === 'expense') return raw
  return 'all'
}

const parseView = (raw: string | undefined): 'mensual' | 'anual' => {
  return raw === 'anual' ? 'anual' : 'mensual'
}

/**
 * El param `month` cumple doble función según `view`:
 *   - view=mensual → 'YYYY-MM' (mes específico) o 'all'
 *   - view=anual  → 'YYYY' (año específico) o 'all'
 *
 * Default según el modo: mes actual / año actual.
 */
const parseMonth = (raw: string | undefined, view: 'mensual' | 'anual'): string => {
  if (raw === 'all') return 'all'
  if (view === 'anual') {
    if (raw && isValidYear(raw)) return raw
    return String(new Date().getFullYear())
  }
  if (raw && isValidMonth(raw)) return raw
  return currentMonth()
}

const PAGE_SIZE = 100

const parsePage = (raw: string | undefined): number => {
  const n = parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    month?: string
    type?: string
    q?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const view = parseView(params.view)
  const month = parseMonth(params.month, view)
  const type = parseType(params.type)
  const q = (params.q ?? '').trim()
  const page = parsePage(params.page)

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
      <TransactionsClient
        transactions={[]}
        accounts={[]}
        categories={[]}
        hasBudget={false}
        filters={{ view, month, type, q }}
      />
    )
  }

  // Build la query filtrada con paginación server-side.
  // Antes esto retornaba TODAS las transacciones del mes sin límite.
  // Un usuario activo con 500+ transacciones/mes cargaba todo a la
  // vez. Ahora PAGE_SIZE=100 con range() de Postgres. El client
  // muestra paginador prev/next. (Auditoría calidad L3.)
  //
  // count='exact' agrega un costo de query (Postgres tiene que
  // contar todas las filas) pero permite mostrar "página 2 de 5" en
  // la UI sin un round-trip extra.
  let txnsQuery = supabase
    .from('transactions')
    .select(
      'id, date, payee_name, category_id, account_id, amount, memo, created_at, is_split, transfer_account_id, transfer_transaction_id, receipt_url, receipt_path, subtransactions(id, category_id, amount, memo)',
      { count: 'exact' },
    )
    .eq('budget_id', budget.id)

  if (q) {
    // Escape PostgREST wildcards from user input. Postgres ilike treats % and _ as wildcards;
    // since users normally type plain text we just escape them.
    const escaped = q.replace(/[%_]/g, '\\$&')
    txnsQuery = txnsQuery.ilike('payee_name', `%${escaped}%`)
  }

  if (month !== 'all') {
    if (view === 'anual') {
      // month aquí es 'YYYY' en modo anual. Año completo.
      txnsQuery = txnsQuery.gte('date', `${month}-01-01`).lte('date', `${month}-12-31`)
    } else {
      const { first, last } = monthBounds(month)
      txnsQuery = txnsQuery.gte('date', first).lte('date', last)
    }
  }

  if (type === 'income') {
    txnsQuery = txnsQuery.gt('amount', 0)
  } else if (type === 'expense') {
    txnsQuery = txnsQuery.lt('amount', 0)
  }

  txnsQuery = txnsQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const [txnsRes, accountsRes, categoriesRes, groupsRes] = await Promise.all([
    txnsQuery,
    supabase
      .from('accounts')
      .select('id, name')
      .eq('budget_id', budget.id)
      .eq('closed', false)
      .order('sort_order'),
    supabase
      .from('categories')
      .select('id, name, group_id')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('category_groups')
      .select('id, name, sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order'),
  ])

  const accounts: AccountOption[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
  }))

  const groupsById = new Map<string, string>()
  for (const g of groupsRes.data ?? []) {
    groupsById.set(g.id as string, g.name as string)
  }

  const categories: CategoryOption[] = (categoriesRes.data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    group_name: groupsById.get(c.group_id as string) ?? '—',
  }))

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

  type RawSub = {
    id: string
    category_id: string | null
    amount: number
    memo: string | null
  }
  const transactions: ListTransaction[] = (txnsRes.data ?? []).map((t) => {
    const rawSubs = (t as unknown as { subtransactions?: RawSub[] }).subtransactions
    const subs = (Array.isArray(rawSubs) ? rawSubs : []).map((s) => ({
      id: s.id,
      category_id: s.category_id ?? null,
      category_name: s.category_id
        ? (categoryNameById.get(s.category_id) ?? null)
        : null,
      amount: Number(s.amount),
      memo: s.memo ?? null,
    }))
    return {
      id: t.id as string,
      date: t.date as string,
      payee_name: (t.payee_name as string | null) ?? null,
      category_id: (t.category_id as string | null) ?? null,
      category_name: t.category_id
        ? (categoryNameById.get(t.category_id as string) ?? null)
        : null,
      account_id: t.account_id as string,
      account_name: accountNameById.get(t.account_id as string) ?? '—',
      amount: Number(t.amount),
      memo: (t.memo as string | null) ?? null,
      is_split: !!t.is_split,
      is_transfer: t.transfer_account_id !== null && t.transfer_account_id !== undefined,
      transfer_account_id: (t.transfer_account_id as string | null) ?? null,
      receipt_url: (t.receipt_url as string | null) ?? null,
      receipt_path: (t.receipt_path as string | null) ?? null,
      subtransactions: subs,
    }
  })

  const filters: FilterState = { view, month, type, q }
  const totalCount = txnsRes.count ?? transactions.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <TransactionsClient
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      hasBudget={true}
      filters={filters}
      pagination={{ page, totalPages, totalCount, pageSize: PAGE_SIZE }}
    />
  )
}
