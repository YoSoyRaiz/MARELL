import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { AjustesClient } from './AjustesClient'
import type { Currency } from './actions'

export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const [profileRes, budgetRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, plan, onboarded, email_notifications')
      .eq('id', user.id)
      .single(),
    activeBudgetId
      ? supabase
          .from('budgets')
          .select('id, name, currency, usd_to_dop_rate')
          .eq('id', activeBudgetId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <AjustesClient
      email={user.email ?? ''}
      displayName={(profileRes.data?.display_name as string | null) ?? ''}
      plan={(profileRes.data?.plan as string | null) ?? 'trial'}
      emailNotifications={
        (profileRes.data?.email_notifications as boolean | null) ?? true
      }
      budget={
        budgetRes.data
          ? {
              id: budgetRes.data.id as string,
              name: budgetRes.data.name as string,
              currency:
                ((budgetRes.data.currency as string) === 'USD'
                  ? 'USD'
                  : 'DOP') as Currency,
              usdToDopRate: Number(
                (budgetRes.data as { usd_to_dop_rate?: number | null })
                  .usd_to_dop_rate ?? 60,
              ),
            }
          : null
      }
    />
  )
}
