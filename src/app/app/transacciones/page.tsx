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

const parseType = (raw: string | undefined): 'all' | 'income' | 'expense' => {
  if (raw === 'income' || raw === 'expense') return raw
  return 'all'
}

const parseMonth = (raw: string | undefined): string => {
  if (raw === 'all') return 'all'
  if (raw && isValidMonth(raw)) return raw
  return currentMonth()
}

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; type?: string; q?: string }>
}) {
  const params = await searchParams
  const month = parseMonth(params.month)
  const type = parseType(params.type)
  const q = (params.q ?? '').trim()

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
        filters={{ month, type, q }}
      />
    )
  }

  // Build the filtered query — include subtransactions so split rows can be
  // rendered with their child categories + amounts.
  let txnsQuery = supabase
    .from('transactions')
    .select(
      'id, date, payee_name, category_id, account_id, amount, memo, created_at, is_split, transfer_account_id, subtransactions(id, category_id, amount, memo)',
    )
    .eq('budget_id', budget.id)

  if (q) {
    // Escape PostgREST wildcards from user input. Postgres ilike treats % and _ as wildcards;
    // since users normally type plain text we just escape them.
    const escaped = q.replace(/[%_]/g, '\\$&')
    txnsQuery = txnsQuery.ilike('payee_name', `%${escaped}%`)
  }

  if (month !== 'all') {
    const { first, last } = monthBounds(month)
    txnsQuery = txnsQuery.gte('date', first).lte('date', last)
  }

  if (type === 'income') {
    txnsQuery = txnsQuery.gt('amount', 0)
  } else if (type === 'expense') {
    txnsQuery = txnsQuery.lt('amount', 0)
  }

  txnsQuery = txnsQuery
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

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
      subtransactions: subs,
    }
  })

  const filters: FilterState = { month, type, q }

  return (
    <TransactionsClient
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      hasBudget={true}
      filters={filters}
    />
  )
}
