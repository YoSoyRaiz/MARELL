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
