'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAzulCheckout } from '@/lib/billing/azul'
import { createPaypalSubscription, cancelPaypalSubscription } from '@/lib/billing/paypal'
import { MARELL_PRO_DOP, MARELL_PRO_USD } from '@/lib/billing/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://marell.app'

export type StartCheckoutResult =
  | { error: string }
  | { redirectUrl: string }

/**
 * Kick off checkout via Azul. Persists the orderId on the profile so
 * the webhook can match the result back. Returns the Azul Payment
 * Page URL the client should redirect to.
 */
export async function startAzulCheckout(): Promise<StartCheckoutResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const session = await createAzulCheckout({
      profileId: user.id,
      plan: MARELL_PRO_DOP,
      successUrl: `${APP_URL}/app/upgrade/success?provider=azul`,
      cancelUrl: `${APP_URL}/app/upgrade?canceled=1`,
    })
    // Stash the order id so the webhook can find this profile when
    // Azul calls us back.
    await supabase
      .from('profiles')
      .update({ subscription_external_id: session.orderId })
      .eq('id', user.id)
    return { redirectUrl: session.redirectUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error iniciando Azul' }
  }
}

/**
 * Kick off checkout via PayPal. Creates the subscription server-side
 * and returns the approval link.
 */
export async function startPaypalCheckout(): Promise<StartCheckoutResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    const session = await createPaypalSubscription({
      profileId: user.id,
      plan: MARELL_PRO_USD,
      email: user.email ?? null,
      successUrl: `${APP_URL}/app/upgrade/success?provider=paypal`,
      cancelUrl: `${APP_URL}/app/upgrade?canceled=1`,
    })
    await supabase
      .from('profiles')
      .update({
        subscription_external_id: session.subscriptionId,
        subscription_provider: 'paypal',
      })
      .eq('id', user.id)
    return { redirectUrl: session.redirectUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error iniciando PayPal' }
  }
}

/**
 * Cancel the current subscription. For PayPal we hit their API; for
 * Azul we just stop attempting to charge the saved card on the next
 * monthly cron. Either way we mark the row canceled locally so the
 * UI updates immediately.
 */
export async function cancelSubscription() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_provider, subscription_external_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Perfil no encontrado' }

  const provider = (profile as { subscription_provider: string | null })
    .subscription_provider
  const extId = (profile as { subscription_external_id: string | null })
    .subscription_external_id

  if (provider === 'paypal' && extId) {
    const r = await cancelPaypalSubscription(extId)
    if (!r.ok) return { error: r.error ?? 'No se pudo cancelar en PayPal' }
  }

  // For Azul we stop charging on next renewal cycle by flipping the
  // local flag. The user still has Pro access until pro_expires_at.
  // Wipe the saved card token at the same time so a future DB
  // breach can't replay it — re-subscribing prompts for the card again.
  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_canceled_at: new Date().toISOString(),
      subscription_card_token: null,
    })
    .eq('id', user.id)

  revalidatePath('/app', 'layout')
  return { success: true as const }
}
