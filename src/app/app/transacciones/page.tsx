import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  TransactionsClient,
  type ListTransaction,
  type AccountOption,
  type CategoryOption,
} from './TransactionsClient'

export default async function TransaccionesPage() {
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
      />
    )
  }

  const [txnsRes, accountsRes, categoriesRes, groupsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, payee_name, category_id, account_id, amount, memo')
      .eq('budget_id', budget.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
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

  const transactions: ListTransaction[] = (txnsRes.data ?? []).map((t) => ({
    id: t.id as string,
    date: t.date as string,
    payee_name: (t.payee_name as string | null) ?? null,
    category_id: (t.category_id as string | null) ?? null,
    category_name: t.category_id ? (categoryNameById.get(t.category_id as string) ?? null) : null,
    account_id: t.account_id as string,
    account_name: accountNameById.get(t.account_id as string) ?? '—',
    amount: Number(t.amount),
    memo: (t.memo as string | null) ?? null,
  }))

  return (
    <TransactionsClient
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      hasBudget={true}
    />
  )
}
