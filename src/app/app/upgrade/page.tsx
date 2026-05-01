import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UpgradeClient } from './UpgradeClient'

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'plan, trial_ends_at, pro_expires_at, subscription_provider, subscription_status, next_billing_at, subscription_card_last4, subscription_card_brand',
    )
    .eq('id', user.id)
    .single()

  return (
    <UpgradeClient
      canceled={params.canceled === '1'}
      plan={(profile?.plan as string | null) ?? 'trial'}
      trialEndsAt={(profile?.trial_ends_at as string | null) ?? null}
      proExpiresAt={(profile?.pro_expires_at as string | null) ?? null}
      subscription={{
        provider: (profile as { subscription_provider?: 'azul' | 'paypal' | null })
          ?.subscription_provider ?? null,
        status: (profile as { subscription_status?: string | null })
          ?.subscription_status as
          | 'active'
          | 'past_due'
          | 'canceled'
          | 'trialing'
          | null,
        nextBillingAt: (profile as { next_billing_at?: string | null })
          ?.next_billing_at ?? null,
        cardLast4: (profile as { subscription_card_last4?: string | null })
          ?.subscription_card_last4 ?? null,
        cardBrand: (profile as { subscription_card_brand?: string | null })
          ?.subscription_card_brand ?? null,
      }}
    />
  )
}
