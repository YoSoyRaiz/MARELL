import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAzulWebhook } from '@/lib/billing/azul'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Azul calls this endpoint after every payment attempt. The body
 * shape depends on the integration mode (PageProductV2 sends form-
 * encoded; the API mode sends JSON). We accept both and reduce to a
 * normalized shape before updating the profile.
 *
 * THIS HANDLER IS A SCAFFOLD. The exact field names and signature
 * verification depend on the Azul docs your account is enrolled
 * under. When credentials land:
 *   - Confirm the body shape (Azul's manual lists every field)
 *   - Confirm the HMAC header name + algorithm
 *   - Wire those into verifyAzulWebhook in lib/billing/azul.ts
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-azul-signature')

  if (!verifyAzulWebhook(signature, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse — Azul's form posts arrive as application/x-www-form-urlencoded
  // while their REST callbacks are JSON. Try both.
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(rawBody)
  } catch {
    const params = new URLSearchParams(rawBody)
    for (const [k, v] of params) payload[k] = v
  }

  const orderId = (payload.OrderNumber ?? payload.orderId) as string | undefined
  const responseCode = (payload.ResponseCode ?? payload.responseCode) as
    | string
    | undefined
  const dataVaultToken = (payload.DataVaultToken ?? payload.cardToken) as
    | string
    | undefined
  const cardLast4 = (payload.CardNumber ?? payload.cardLast4) as
    | string
    | undefined
  const cardBrand = (payload.CardBrand ?? payload.cardBrand) as
    | string
    | undefined
  const azulOrderId = (payload.AzulOrderId ?? payload.azulOrderId) as
    | string
    | undefined

  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find the profile that started this order. We stashed orderId on
  // `subscription_external_id` when we created the checkout session.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('subscription_external_id', orderId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Unknown order' }, { status: 404 })
  }

  const profileId = profile.id as string
  // ResponseCode ISO 1A is the canonical "approved" code on Azul.
  // Failed payments come with codes like 51, 05, 14, etc.
  const success = responseCode === 'ISO8583' || responseCode === 'ISO1A' || responseCode === '00'

  // Idempotency: Azul retransmits webhooks if it doesn't see a 200
  // ack within their timeout window. Reject duplicates by checking the
  // payment_events ledger before doing any state-changing work.
  const dedupeId = (azulOrderId ?? orderId) as string
  const { data: existingEvent } = await supabase
    .from('payment_events')
    .select('id')
    .eq('provider', 'azul')
    .eq('external_id', dedupeId)
    .eq('status', success ? 'success' : 'failed')
    .maybeSingle()
  if (existingEvent) {
    return NextResponse.json({ ok: true, deduped: true })
  }

  // Whitelist explícito de campos. Azul puede mandar de vuelta
  // datos sensibles del cardholder (nombre, BIN, etc.) en el payload.
  // Solo guardamos los IDs y status code necesarios para reconciliación.
  // (Auditoría 2026-05-24, A7.)
  const safeRawPayload: Record<string, unknown> = {
    OrderNumber: orderId,
    AzulOrderId: azulOrderId,
    ResponseCode: responseCode,
    CardBrand: cardBrand,
    // CardNumber/CardLast4 ya viene enmascarado por Azul; safe a guardar.
    CardLast4: cardLast4,
  }

  // Append to the immutable ledger first so we always have a paper trail.
  await supabase.from('payment_events').insert({
    profile_id: profileId,
    provider: 'azul',
    external_id: dedupeId,
    amount: 999,
    currency: 'DOP',
    status: success ? 'success' : 'failed',
    raw_payload: safeRawPayload,
  } as never)

  if (success) {
    const now = new Date()
    const nextBilling = new Date(now)
    nextBilling.setMonth(nextBilling.getMonth() + 1)
    const proExpires = new Date(nextBilling)
    proExpires.setDate(proExpires.getDate() + 3) // 3-day grace period

    await supabase
      .from('profiles')
      .update({
        plan: 'pro',
        subscription_provider: 'azul',
        subscription_status: 'active',
        subscription_card_token: dataVaultToken ?? null,
        subscription_card_last4: cardLast4 ?? null,
        subscription_card_brand: cardBrand ?? null,
        last_payment_at: now.toISOString(),
        next_billing_at: nextBilling.toISOString(),
        pro_expires_at: proExpires.toISOString(),
      } as never)
      .eq('id', profileId)
  } else {
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'past_due',
      } as never)
      .eq('id', profileId)
  }

  return NextResponse.json({ ok: true })
}
