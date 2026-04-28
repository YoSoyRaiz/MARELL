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
    .select('display_name, plan, onboarded')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarded) redirect('/onboarding')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let readyToAssign = 0

  if (budget) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('balance, type')
      .eq('budget_id', budget.id)

    const cashTypes = ['checking', 'savings', 'cash']
    const totalCash = (accounts ?? [])
      .filter((a) => cashTypes.includes(a.type as string))
      .reduce((s, a) => s + Number(a.balance), 0)

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const { data: assignments } = await supabase
      .from('monthly_assignments')
      .select('assigned')
      .eq('budget_id', budget.id)
      .eq('month', month)

    const totalAssigned = (assignments ?? []).reduce((s, a) => s + Number(a.assigned), 0)
    readyToAssign = totalCash - totalAssigned
  }

  return (
    <AppShell
      displayName={profile?.display_name ?? null}
      plan={profile?.plan ?? 'trial'}
      budget={budget ?? null}
      readyToAssign={readyToAssign}
    >
      {children}
    </AppShell>
  )
}
