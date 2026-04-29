import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CuentasClient, type ListAccount } from './CuentasClient'
import type { AccountType } from '@/app/onboarding/wizard/types'

export default async function CuentasPage() {
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
    return <CuentasClient accounts={[]} hasBudget={false} />
  }

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type, balance, note, closed, sort_order')
    .eq('budget_id', budget.id)
    .order('sort_order', { ascending: true })

  const accounts: ListAccount[] = (accountsRaw ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    type: a.type as AccountType,
    balance: Number(a.balance),
    note: (a.note as string | null) ?? null,
    closed: Boolean(a.closed),
  }))

  return <CuentasClient accounts={accounts} hasBudget={true} />
}
