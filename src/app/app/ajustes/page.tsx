import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AjustesClient } from './AjustesClient'
import type { Currency } from './actions'

export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, budgetRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, plan, onboarded')
      .eq('id', user.id)
      .single(),
    supabase
      .from('budgets')
      .select('id, name, currency')
      .eq('created_by', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <AjustesClient
      email={user.email ?? ''}
      displayName={(profileRes.data?.display_name as string | null) ?? ''}
      plan={(profileRes.data?.plan as string | null) ?? 'trial'}
      budget={
        budgetRes.data
          ? {
              id: budgetRes.data.id as string,
              name: budgetRes.data.name as string,
              currency:
                ((budgetRes.data.currency as string) === 'USD'
                  ? 'USD'
                  : 'DOP') as Currency,
            }
          : null
      }
    />
  )
}
