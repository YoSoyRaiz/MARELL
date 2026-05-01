import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeAzulSavedCard } from '@/lib/billing/azul'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Daily cron that runs the Azul subscription renewals. PayPal does
 * its own recurring billing — for Azul we have to charge the saved
 * tokenized card ourselves on the day the subscription is due.
 *
 * Selects every active Azul-paying profile whose next_billing_at is
 * <= today, charges the token, and updates the profile based on the
 * result. Failures move the user to past_due (UI then prompts them
 * to update their card).
 */

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Cron lock via the `acquire_cron_lock` RPC (migration 2026_05_05).
  // Returns false if today's run is already in flight; cleans up
  // locks older than 12h so a failed run doesn't stay locked forever.
  const today = now.toISOString().slice(0, 10)
  type LockRpcArgs = { p_route: string; p_run_date: string }
  const lockResp = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: LockRpcArgs,
    ) => Promise<{ data: boolean | null; error: unknown }>
  }).rpc('acquire_cron_lock', {
    p_route: 'azul-renewals',
    p_run_date: today,
  })
  if (!lockResp.data) {
    return NextResponse.json({ ok: true, deduped: true })
  }

  const { data: due, error } = await supabase
    .from('profiles')
    .select(
      'id, subscription_card_token, subscription_external_id, next_billing_at',
    )
    .eq('subscription_provider', 'azul')
    .eq('subscription_status', 'active')
    .lte('next_billing_at', now.toISOString())
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, charged: 0 })
  }

  let charged = 0
  let failed = 0

  for (const row of due) {
    const profile = row as unknown as {
      id: string
      subscription_card_token: string | null
      subscription_external_id: string | null
    }
    if (!profile.subscription_card_token) {
      // Can't charge without a token — flip to past_due so the user
      // re-enters their card on next visit.
      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' } as never)
        .eq('id', profile.id)
      failed++
      continue
    }

    const orderId = `marell_renew_${profile.id}_${Date.now()}`
    const result = await chargeAzulSavedCard({
      cardToken: profile.subscription_card_token,
      amount: 999,
      currency: 'DOP',
      orderId,
    })

    await supabase.from('payment_events').insert({
      profile_id: profile.id,
      provider: 'azul',
      external_id: result.azulOrderId ?? orderId,
      amount: 999,
      currency: 'DOP',
      status: result.success ? 'success' : 'failed',
      error_message: result.errorMessage ?? null,
      raw_payload: result.rawResponse as Record<string, unknown> | null,
    } as never)

    if (result.success) {
      const nextBilling = new Date(now)
      nextBilling.setMonth(nextBilling.getMonth() + 1)
      const proExpires = new Date(nextBilling)
      proExpires.setDate(proExpires.getDate() + 3)
      await supabase
        .from('profiles')
        .update({
          last_payment_at: now.toISOString(),
          next_billing_at: nextBilling.toISOString(),
          pro_expires_at: proExpires.toISOString(),
          subscription_status: 'active',
        } as never)
        .eq('id', profile.id)
      charged++
    } else {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' } as never)
        .eq('id', profile.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, charged, failed })
}
