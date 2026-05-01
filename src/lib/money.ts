// Currency-aware money formatting.
//
// MARELL is launched for the Dominican Republic market, so DOP is the default.
// "RD$" is the canonical Spanish-DR symbol for Dominican peso; "$" is used for
// USD (the only other currency the app currently supports).
//
// Numbers always use US-style thousand separator + 2 decimal precision because
// that's the convention DR users expect (`RD$ 1,234.56`).

export type Currency = 'DOP' | 'USD'

export function currencySymbol(c: Currency): string {
  return c === 'USD' ? '$' : 'RD$'
}

export function formatMoney(n: number, currency: Currency = 'DOP'): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (n < -0.005) return `−${symbol}${abs}`
  return `${symbol}${abs}`
}

export function formatMoneyShort(n: number, currency: Currency = 'DOP'): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n < -0.005) return `−${symbol}${abs}`
  return `${symbol}${abs}`
}

/** Coerces an unknown string into a valid Currency, defaulting to DOP. */
export function parseCurrency(value: string | null | undefined): Currency {
  return value === 'USD' ? 'USD' : 'DOP'
}

/**
 * Convert an amount expressed in `from` currency into `to`, using the
 * user-supplied USD↔DOP rate. The rate represents how many DOP one USD
 * buys (e.g. 60 means 1 USD = 60 DOP).
 *
 * - DOP → DOP / USD → USD: identity
 * - USD → DOP: amount * rate
 * - DOP → USD: amount / rate
 */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  usdToDopRate: number,
): number {
  if (from === to) return amount
  if (!Number.isFinite(usdToDopRate) || usdToDopRate <= 0) return amount
  if (from === 'USD' && to === 'DOP') return amount * usdToDopRate
  if (from === 'DOP' && to === 'USD') return amount / usdToDopRate
  return amount
}
