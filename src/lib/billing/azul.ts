// Azul Dominicana integration.
//
// Azul is the local card processor in DR. They expose a REST API that
// requires SSL client certificates in production. Their flow:
//
//   1. We generate an order id and HMAC-sign a redirect to their
//      "PageProductV2" hosted form with the amount and metadata.
//   2. The user enters card details on Azul's domain (PCI scope stays
//      with them).
//   3. Azul calls our webhook with the result + a tokenized card so we
//      can charge it monthly without re-prompting.
//   4. Each month, our `/api/cron/azul-renewals` route pulls every
//      profile whose next_billing_at <= today and POSTs to Azul's
//      `/payments` endpoint with the saved token.
//
// THIS FILE IS A SCAFFOLD. The actual HTTP calls require:
//   - AZUL_MERCHANT_ID
//   - AZUL_AUTH1, AZUL_AUTH2 (their basic-auth header pair)
//   - AZUL_API_KEY
//   - AZUL_PAYMENT_PAGE_URL (e.g. https://pagos.azul.com.do/PaymentPage/)
//   - AZUL_WEBHOOK_HMAC_SECRET (for verifying their callback)
//   - SSL certificate file path (production only) — typically loaded
//     into a custom https.Agent.
//
// When the user provides credentials, replace the TODO blocks below
// with real calls. The function signatures are stable so the rest of
// the app doesn't need to change.

import { createHmac, timingSafeEqual } from 'crypto'
import type { BillingProvider, PricingPlan } from './types'

export interface AzulCheckoutSession {
  /** URL to redirect the user to in order to enter card details. */
  redirectUrl: string
  /** Our internal order id we'll match against the webhook later. */
  orderId: string
}

export interface AzulChargeResult {
  success: boolean
  authorizationCode?: string
  azulOrderId?: string
  errorMessage?: string
  rawResponse?: unknown
}

/**
 * Build a redirect URL that takes the user to Azul's hosted Payment
 * Page. We pass our own `OrderNumber` so the webhook can match the
 * payment back to a profile.
 *
 * Replace the body of this function with the real signed-URL
 * construction once credentials are available.
 */
export async function createAzulCheckout(input: {
  profileId: string
  plan: PricingPlan
  successUrl: string
  cancelUrl: string
}): Promise<AzulCheckoutSession> {
  // TODO: implement once AZUL_MERCHANT_ID + AZUL_AUTH* are set.
  // Pseudocode:
  //
  //   const orderId = `marell_${input.profileId}_${Date.now()}`
  //   const params = {
  //     MerchantId: process.env.AZUL_MERCHANT_ID,
  //     OrderNumber: orderId,
  //     Amount: input.plan.pricePerMonth.toFixed(2),
  //     CurrencyCode: input.plan.currency === 'DOP' ? '214' : '840',
  //     ReturnUrl: input.successUrl,
  //     CancelUrl: input.cancelUrl,
  //     // Tokenize the card so we can charge it again next month
  //     // without re-prompting. Azul calls this "Bóveda" or
  //     // "DataVault".
  //     UseDataVault: '1',
  //   }
  //   const authHash = hmacSha512(
  //     `${params.MerchantId}|${params.OrderNumber}|${params.Amount}|${params.CurrencyCode}`,
  //     process.env.AZUL_API_KEY,
  //   )
  //   return {
  //     orderId,
  //     redirectUrl: `${process.env.AZUL_PAYMENT_PAGE_URL}?${new URLSearchParams({ ...params, AuthHash: authHash })}`,
  //   }

  if (!process.env.AZUL_MERCHANT_ID) {
    throw new Error(
      'Azul no configurado. Pendiente: AZUL_MERCHANT_ID y AZUL_API_KEY.',
    )
  }
  return {
    orderId: `marell_${input.profileId}_${Date.now()}`,
    redirectUrl: input.cancelUrl, // safe fallback until real impl lands
  }
}

/**
 * Verify the HMAC-SHA-256 signature Azul sends with their server-to-
 * server webhook. The header value is hex-encoded; we recompute the
 * HMAC of the raw body using AZUL_WEBHOOK_HMAC_SECRET and compare
 * with timingSafeEqual to avoid timing leaks.
 *
 * Azul's docs vary by integration tier — some accounts use SHA-256,
 * others SHA-512. We support both: try SHA-256 first, then SHA-512
 * if that fails. The merchant configures the secret on their dashboard
 * so the secret value itself is what we control here.
 */
export function verifyAzulWebhook(
  signature: string | null,
  rawBody: string,
): boolean {
  const secret = process.env.AZUL_WEBHOOK_HMAC_SECRET
  if (!secret) {
    // Without the secret we can't verify. Reject in production; allow
    // in dev so the route stays testable.
    return process.env.NODE_ENV !== 'production'
  }
  if (!signature) return false

  const provided = signature.trim().toLowerCase()
  const providedBuf = Buffer.from(provided, 'hex')
  if (providedBuf.length === 0) return false

  for (const algo of ['sha256', 'sha512'] as const) {
    const expected = createHmac(algo, secret).update(rawBody).digest()
    if (expected.length !== providedBuf.length) continue
    try {
      if (timingSafeEqual(expected, providedBuf)) return true
    } catch {
      // length mismatch — fall through to the next algo
    }
  }
  return false
}

/**
 * Charge a previously-saved card token. Used by the monthly renewal
 * cron once the first payment locked in a token via the Bóveda flow.
 *
 * Replace with real Azul `/payments` POST.
 */
export async function chargeAzulSavedCard(input: {
  cardToken: string
  amount: number
  currency: 'DOP' | 'USD'
  orderId: string
}): Promise<AzulChargeResult> {
  if (!process.env.AZUL_MERCHANT_ID) {
    return {
      success: false,
      errorMessage: 'Azul no configurado',
    }
  }
  // TODO: POST to Azul /payments with DataVaultToken=cardToken
  void input
  return {
    success: false,
    errorMessage: 'Implementación pendiente',
  }
}

export const AZUL_PROVIDER: BillingProvider = 'azul'
