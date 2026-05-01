// Shared billing types used by the upgrade flow, webhooks, and the
// Ajustes UI. Provider-specific details live in `azul.ts` / `paypal.ts`.

export type BillingProvider = 'azul' | 'paypal'

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'

export interface PricingPlan {
  id: string
  name: string
  /** Per-month price in the displayed currency. */
  pricePerMonth: number
  currency: 'DOP' | 'USD'
  /** Highlighted line items shown on the upgrade page. */
  features: string[]
}

export const MARELL_PRO_DOP: PricingPlan = {
  id: 'pro_monthly_dop',
  name: 'Pro Mensual',
  pricePerMonth: 999,
  currency: 'DOP',
  features: [
    'Todas las metas y reportes',
    'Importadores de bancos RD',
    'Categorías y cuentas ilimitadas',
    'Recurrencias automáticas',
    'Presupuestos compartidos (familia)',
    'Soporte prioritario',
  ],
}

// PayPal subscriptions need to be priced in USD because most users
// outside DR pay in dollars. We convert at checkout time using the
// budget's usd_to_dop_rate setting.
export const MARELL_PRO_USD: PricingPlan = {
  id: 'pro_monthly_usd',
  name: 'Pro Mensual',
  pricePerMonth: 16.5, // ~RD$999 at 60.5 DOP/USD
  currency: 'USD',
  features: MARELL_PRO_DOP.features,
}

export interface SubscriptionSnapshot {
  provider: BillingProvider | null
  status: SubscriptionStatus | null
  externalId: string | null
  cardLast4: string | null
  cardBrand: string | null
  lastPaymentAt: string | null
  nextBillingAt: string | null
  canceledAt: string | null
}
