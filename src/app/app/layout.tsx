import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from './AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, plan, onboarded, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarded) redirect('/onboarding')

  // Single admin check for the layout — passed down so the profile popover
  // can show the "Admin" link only when relevant.
  const { data: isAdmin } = await supabase.rpc('is_admin')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let readyToAssign = 0

  if (budget) {
    // Ready to Assign = total_cash − Σ(category.available_lifetime)
    // where category.available = lifetime_assignments + lifetime_activity.
    // This is the YNAB formula: cash that hasn't been earmarked to a
    // category. Carry-over of unspent balances + overspending coverage
    // both fall out of this naturally.
    const [accountsRes, assignsRes, txnsRes, subsRes] = await Promise.all([
      supabase.from('accounts').select('balance, type').eq('budget_id', budget.id),
      supabase.from('monthly_assignments').select('assigned').eq('budget_id', budget.id),
      supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('budget_id', budget.id)
        .not('category_id', 'is', null),
      supabase
        .from('subtransactions')
        .select('amount, transactions!inner(budget_id)')
        .eq('transactions.budget_id', budget.id)
        .not('category_id', 'is', null),
    ])

    const cashTypes = ['checking', 'savings', 'cash']
    const totalCash = (accountsRes.data ?? [])
      .filter((a) => cashTypes.includes(a.type as string))
      .reduce((s, a) => s + Number(a.balance), 0)

    const totalAssignedLifetime = (assignsRes.data ?? []).reduce(
      (s, a) => s + Number(a.assigned),
      0,
    )
    const totalCategorizedActivity =
      (txnsRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0) +
      (subsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

    const sumCategoryAvailable = totalAssignedLifetime + totalCategorizedActivity
    readyToAssign = Math.round((totalCash - sumCategoryAvailable) * 100) / 100
  }

  return (
    <AppShell
      displayName={profile?.display_name ?? null}
      email={user.email ?? null}
      plan={profile?.plan ?? 'trial'}
      trialEndsAt={(profile?.trial_ends_at as string | null) ?? null}
      budget={budget ?? null}
      readyToAssign={readyToAssign}
      isAdmin={!!isAdmin}
    >
      {children}
    </AppShell>
  )
}
