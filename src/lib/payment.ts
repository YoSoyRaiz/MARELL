// Pricing + bank-transfer constants for MARELL Pro.
// Edit this file when launching new tiers / changing the destination
// account; everything user-facing in /pricing reads from here.

export const PRO_PRICE_MONTH_DOP = 999
export const PRO_PRICE_YEAR_DOP = 9990
export const PRO_PRICE_YEAR_SAVINGS_PCT = Math.round(
  (1 - PRO_PRICE_YEAR_DOP / (PRO_PRICE_MONTH_DOP * 12)) * 100,
)

export interface BankAccount {
  bank: string
  holder: string
  rnc: string | null
  type: string
  number: string
}

// Update with the founder's actual destination account before launch.
// Multiple banks let the user pick the one they bank with for free transfers.
export const PAYMENT_ACCOUNTS: BankAccount[] = [
  {
    bank: 'Banco Popular',
    holder: 'MAXWELL HERBERT',
    rnc: null,
    type: 'Cuenta de Ahorros',
    number: '766500417',
  },
  {
    bank: 'BHD',
    holder: 'MAXWELL HERBERT',
    rnc: null,
    type: 'Cuenta de Ahorros',
    number: '20887000018',
  },
]

export const PAYMENT_SUPPORT_EMAIL = 'notificaciones@marell.app'

/**
 * Per-user reference code that the user includes in the transfer concept
 * so the admin can match it to the right account. We use the first 8 chars
 * of the auth UUID — collision-safe enough for human matching.
 */
export function paymentReference(userId: string): string {
  return `MARELL-${userId.slice(0, 8).toUpperCase()}`
}
