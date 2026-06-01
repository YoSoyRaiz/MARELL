import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { ProgramadasClient, type ListScheduled } from './ProgramadasClient'
import { materializeDue, type Frequency, type ScheduledType } from './actions'

export default async function ProgramadasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = activeBudgetId
    ? await supabase
        .from('budgets')
        .select('id')
        .eq('id', activeBudgetId)
        .maybeSingle()
    : { data: null }

  if (!budget) {
    return (
      <ProgramadasClient
        scheduled={[]}
        accounts={[]}
        categories={[]}
        hasBudget={false}
      />
    )
  }

  // Materialize anything due before showing the list, so the user sees
  // the up-to-date "next" dates and the new transactions appear immediately.
  // Defensive: a failure here shouldn't 500 the entire page.
  try {
    await materializeDue(budget.id as string)
  } catch (err) {
    console.error('[materializeDue] failed', err)
  }

  const [schedRes, acctsRes, catsRes, groupsRes] = await Promise.all([
    supabase
      .from('scheduled_transactions')
      .select(
        'id, account_id, category_id, payee_name, memo, amount, frequency, next_date, active',
      )
      .eq('budget_id', budget.id)
      .order('next_date', { ascending: true }),
    supabase
      .from('accounts')
      .select('id, name, closed')
      .eq('budget_id', budget.id)
      .eq('closed', false)
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, group_id')
      .eq('budget_id', budget.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('category_groups')
      .select('id, name')
      .eq('budget_id', budget.id),
  ])

  const groupsById = new Map<string, string>()
  for (const g of groupsRes.data ?? []) {
    groupsById.set(g.id as string, g.name as string)
  }

  const accountsById = new Map<string, string>()
  for (const a of acctsRes.data ?? []) {
    accountsById.set(a.id as string, a.name as string)
  }

  const categoriesById = new Map<string, { name: string; groupName: string }>()
  for (const c of catsRes.data ?? []) {
    categoriesById.set(c.id as string, {
      name: c.name as string,
      groupName: groupsById.get(c.group_id as string) ?? '—',
    })
  }

  const scheduled: ListScheduled[] = (schedRes.data ?? []).map((s) => {
    const rawAmount = Number(s.amount)
    const type: ScheduledType = rawAmount >= 0 ? 'income' : 'expense'
    const cat = s.category_id ? categoriesById.get(s.category_id as string) : null
    return {
      id: s.id as string,
      accountId: s.account_id as string,
      accountName: accountsById.get(s.account_id as string) ?? '—',
      categoryId: (s.category_id as string | null) ?? null,
      categoryName: cat?.name ?? null,
      groupName: cat?.groupName ?? null,
      payeeName: (s.payee_name as string) ?? '',
      memo: (s.memo as string | null) ?? null,
      amount: Math.abs(rawAmount),
      type,
      frequency: s.frequency as Frequency,
      nextDate: s.next_date as string,
      active: !!s.active,
    }
  })

  const accounts = (acctsRes.data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
  }))

  const categories = (catsRes.data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    group_name: groupsById.get(c.group_id as string) ?? '—',
  }))

  return (
    <ProgramadasClient
      scheduled={scheduled}
      accounts={accounts}
      categories={categories}
      hasBudget={true}
    />
  )
}
