import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaypalWebhook } from '@/lib/billing/paypal'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * PayPal subscriptions webhook. We listen for the lifecycle events:
 *
 *   BILLING.SUBSCRIPTION.ACTIVATED   → user just approved, mark Pro
 *   BILLING.SUBSCRIPTION.CANCELLED   → user canceled
 *   BILLING.SUBSCRIPTION.EXPIRED     → trial ended without payment
 *   BILLING.SUBSCRIPTION.SUSPENDED   → temp suspension (we treat as past_due)
 *   PAYMENT.SALE.COMPLETED           → monthly payment landed → extend pro_expires_at
 *   BILLING.SUBSCRIPTION.PAYMENT.FAILED → mark past_due
 *
 * The custom_id we set when creating the subscription rides through
 * every event so we can map back to the profile without a separate
 * lookup table.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })

  const verified = await verifyPaypalWebhook(headers, rawBody)
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    id?: string
    event_type?: string
    resource?: Record<string, unknown>
  } = {}
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = event.event_type ?? ''
  const resource = event.resource ?? {}
  const eventId = event.id

  // Whitelist explícito de campos para guardar en payment_events.
  // Antes guardábamos el `event` completo, que incluía PII del payer
  // (email, name, billing address, IP, posiblemente últimos 4 de la
  // tarjeta). Si la DB se filtra, no exponemos más de lo necesario
  // para reconciliación. (Auditoría 2026-05-24, A7.)
  const safeRawPayload: Record<string, unknown> = {
    event_id: event.id,
    event_type: event.event_type,
    create_time: (event as Record<string, unknown>).create_time,
    resource_id: resource.id,
    resource_type: (event as Record<string, unknown>).resource_type,
    summary: (event as Record<string, unknown>).summary,
  }

  // Defense in depth: only accept UUIDs as profile_id from the
  // webhook payload. Anything else is dropped before we hit the DB.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const rawCustom = (resource.custom_id ?? resource.custom) as string | undefined
  const profileIdSafe =
    rawCustom && UUID_RE.test(rawCustom) ? rawCustom : undefined

  // Idempotency: PayPal sends each event with a stable `id`. If we
  // already recorded a payment_event with that external_id we ack
  // without re-applying the side-effects.
  if (eventId) {
    const adminCheck = createAdminClient()
    const { data: existing } = await adminCheck
      .from('payment_events')
      .select('id')
      .eq('provider', 'paypal')
      .eq('external_id', eventId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true })
    }
  }
  const profileId = profileIdSafe
  const subId =
    (resource.id as string | undefined) ??
    ((resource.billing_agreement_id as string | undefined) ?? undefined)

  if (!profileId) {
    // Not all events carry custom_id — for those (e.g. PAYMENT.SALE.COMPLETED
    // which only has billing_agreement_id) we fall back to a lookup by
    // subscription id stored on the profile.
    if (!subId) {
      return NextResponse.json({ ok: true, ignored: 'missing identifiers' })
    }
  }

  const supabase = createAdminClient()

  let profileLookup
  if (profileId) {
    profileLookup = await supabase
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .maybeSingle()
  } else if (subId) {
    profileLookup = await supabase
      .from('profiles')
      .select('id')
      .eq('subscription_external_id', subId)
      .maybeSingle()
  }
  const targetProfileId = profileLookup?.data?.id as string | undefined
  if (!targetProfileId) {
    return NextResponse.json({ ok: true, ignored: 'unknown profile' })
  }

  const now = new Date()

  switch (type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
      const nextBilling = new Date(now)
      nextBilling.setMonth(nextBilling.getMonth() + 1)
      const proExpires = new Date(nextBilling)
      proExpires.setDate(proExpires.getDate() + 3)
      await supabase
        .from('profiles')
        .update({
          plan: 'pro',
          subscription_provider: 'paypal',
          subscription_external_id: subId ?? null,
          subscription_status: 'active',
          last_payment_at: now.toISOString(),
          next_billing_at: nextBilling.toISOString(),
          pro_expires_at: proExpires.toISOString(),
        })
        .eq('id', targetProfileId)
      break
    }

    case 'PAYMENT.SALE.COMPLETED': {
      // Monthly successful payment. Push the pro expiration forward.
      const nextBilling = new Date(now)
      nextBilling.setMonth(nextBilling.getMonth() + 1)
      const proExpires = new Date(nextBilling)
      proExpires.setDate(proExpires.getDate() + 3)
      const amount =
        (resource.amount as { total?: string } | undefined)?.total ?? '0'
      const currencyVal =
        ((resource.amount as { currency?: string } | undefined)?.currency ===
        'USD'
          ? 'USD'
          : 'DOP') as 'USD' | 'DOP'
      await supabase.from('payment_events').insert({
        profile_id: targetProfileId,
        provider: 'paypal',
        external_id: eventId ?? subId ?? null,
        amount: parseFloat(amount),
        currency: currencyVal,
        status: 'success',
        raw_payload: safeRawPayload,
      })
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          last_payment_at: now.toISOString(),
          next_billing_at: nextBilling.toISOString(),
          pro_expires_at: proExpires.toISOString(),
        })
        .eq('id', targetProfileId)
      break
    }

    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      await supabase.from('payment_events').insert({
        profile_id: targetProfileId,
        provider: 'paypal',
        external_id: eventId ?? subId ?? null,
        amount: 0,
        currency: 'USD',
        status: 'failed',
        raw_payload: safeRawPayload,
      })
      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('id', targetProfileId)
      break
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'canceled',
          subscription_canceled_at: now.toISOString(),
        })
        .eq('id', targetProfileId)
      break
    }

    default:
      // Ignore other events but ack so PayPal doesn't retry.
      break
  }

  return NextResponse.json({ ok: true })
}
