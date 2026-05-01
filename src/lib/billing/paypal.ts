// PayPal Subscriptions API integration.
//
// Cleaner than Azul because PayPal handles the recurring billing
// itself — we don't have to charge the card monthly, just listen to
// webhooks. Flow:
//
//   1. We have a Plan pre-created in PayPal's dashboard (one-time
//      setup). The plan id goes in PAYPAL_PLAN_ID.
//   2. Server calls /v1/billing/subscriptions to create a subscription
//      and gets back an approval URL.
//   3. User goes to PayPal, approves.
//   4. PayPal sends a BILLING.SUBSCRIPTION.ACTIVATED webhook to us.
//   5. Each billing cycle, PayPal sends PAYMENT.SALE.COMPLETED
//      (or BILLING.SUBSCRIPTION.PAYMENT.FAILED on errors).
//
// THIS FILE IS A SCAFFOLD. The actual HTTP calls require:
//   - PAYPAL_CLIENT_ID
//   - PAYPAL_CLIENT_SECRET
//   - PAYPAL_PLAN_ID (created once in PayPal dashboard, RD$999/mes
//     equivalent in USD)
//   - PAYPAL_WEBHOOK_ID (used to verify webhook signatures)
//   - PAYPAL_BASE_URL (sandbox vs live)
//
// When the user provides credentials, replace the TODO blocks. The
// function signatures are stable.

import type { BillingProvider, PricingPlan } from './types'

export interface PaypalCheckoutSession {
  redirectUrl: string
  /** PayPal's subscription id (I-XXXXXXXX). Stored on profile so we
      can match webhooks back. */
  subscriptionId: string
}

const PAYPAL_BASE_URL = () =>
  process.env.PAYPAL_BASE_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com')

async function getAccessToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) return null

  const auth = Buffer.from(`${id}:${secret}`).toString('base64')
  try {
    const res = await fetch(`${PAYPAL_BASE_URL()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { access_token?: string }
    return json.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Create a subscription in PayPal and return the approval URL the
 * user needs to visit.
 */
export async function createPaypalSubscription(input: {
  profileId: string
  plan: PricingPlan
  email: string | null
  successUrl: string
  cancelUrl: string
}): Promise<PaypalCheckoutSession> {
  const planId = process.env.PAYPAL_PLAN_ID
  if (!planId) {
    throw new Error(
      'PayPal no configurado. Pendiente: PAYPAL_PLAN_ID y PAYPAL_CLIENT_*.',
    )
  }
  const token = await getAccessToken()
  if (!token) {
    throw new Error('No se pudo autenticar contra PayPal.')
  }

  const res = await fetch(`${PAYPAL_BASE_URL()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Idempotency on retry — PayPal de-dups requests with this header.
      'PayPal-Request-Id': `marell-${input.profileId}-${Date.now()}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      // The custom_id rides through every webhook so we can map back
      // to our internal profile without storing PayPal's id ourselves.
      custom_id: input.profileId,
      subscriber: input.email
        ? { email_address: input.email }
        : undefined,
      application_context: {
        brand_name: 'MARELL',
        locale: 'es-DO',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`PayPal rechazó la suscripción: ${errBody.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    id?: string
    links?: Array<{ rel: string; href: string }>
  }
  const approve = json.links?.find((l) => l.rel === 'approve')?.href
  if (!json.id || !approve) {
    throw new Error('Respuesta de PayPal sin link de aprobación.')
  }
  return { subscriptionId: json.id, redirectUrl: approve }
}

/**
 * Cancel a subscription on the PayPal side. The webhook will follow
 * up with BILLING.SUBSCRIPTION.CANCELLED so our DB stays in sync.
 */
export async function cancelPaypalSubscription(
  subscriptionId: string,
  reason: string = 'User requested cancellation',
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken()
  if (!token) return { ok: false, error: 'No se pudo autenticar' }
  try {
    const res = await fetch(
      `${PAYPAL_BASE_URL()}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: body.slice(0, 200) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

/**
 * Verify a webhook signature with PayPal. PayPal exposes a
 * verification endpoint that takes the headers + body and returns
 * VERIFIED / FAILURE.
 */
export async function verifyPaypalWebhook(
  headers: Record<string, string>,
  rawBody: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    return process.env.NODE_ENV !== 'production'
  }
  const token = await getAccessToken()
  if (!token) return false

  try {
    const res = await fetch(
      `${PAYPAL_BASE_URL()}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      },
    )
    if (!res.ok) return false
    const json = (await res.json()) as { verification_status?: string }
    return json.verification_status === 'SUCCESS'
  } catch {
    return false
  }
}

export const PAYPAL_PROVIDER: BillingProvider = 'paypal'
