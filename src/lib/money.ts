// Currency-aware money formatting.
//
// MARELL is launched for the Dominican Republic market, so DOP is the default.
// "RD$" is the canonical Spanish-DR symbol for Dominican peso; "$" is used for
// USD (the only other currency the app currently supports).
//
// Numbers always use US-style thousand separator + 2 decimal precision because
// that's the convention DR users expect (`RD$ 1,234.56`).

export type Currency = 'DOP' | 'USD'

/**
 * Tasa USD↔DOP por defecto. Se usa cuando el budget aún no tiene un
 * `usd_to_dop_rate` configurado (rare, mostly during onboarding).
 * Antes este 60 estaba duplicado como literal en layout.tsx + page.tsx;
 * ahora un solo sitio.
 */
export const DEFAULT_USD_TO_DOP_RATE = 60

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

// ── Money input helpers ─────────────────────────────────────────
// Centralizados aquí. Antes estaban duplicados en AssignPopover,
// plan/InlineMoneyEdit, plan/MoveMoneyModal y otros sitios — cada uno
// con su propia variación. Ahora un solo source of truth.

/**
 * Parsea un string del usuario a un número.
 *   "1,234.56" → 1234.56
 *   "1.234,56" → 1234.56 (formato europeo)
 *   "1234"     → 1234
 *   ""         → null
 *   "abc"      → null
 *
 * Tolera con/sin separadores de miles, con/sin decimal. Lo que NO es
 * número se ignora silenciosamente.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null
  // Parentheses indicate negative (accounting style).
  const parenNeg = s.startsWith('(') && s.endsWith(')')
  if (parenNeg) s = s.slice(1, -1).trim()
  s = s.replace(/[$€£¥]/g, '').replace(/\s/g, '').replace(/^[−-]/, '-')
  if (!s || s === '-') return null
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // El separador más a la derecha es el decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const after = s.split(',').pop() ?? ''
    if (after.length <= 2) {
      s = s.replace(/,/g, '.')
    } else {
      s = s.replace(/,/g, '')
    }
  }
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return parenNeg ? -Math.abs(n) : n
}

/**
 * Format mientras se escribe — agrega separadores de miles pero
 * preserva el separador decimal si el user ya lo escribió.
 *   "1234"    → "1,234"
 *   "1234.5"  → "1,234.5"
 *   "1234.56" → "1,234.56"
 *
 * Reglas:
 *   - Acepta solo dígitos y un único punto (decimal).
 *   - Máximo 2 decimales.
 *   - String vacío preserva.
 */
export function formatAmountWhileTyping(raw: string): string {
  if (!raw) return ''
  // Permite cualquier coma → punto para que el user pueda escribir lo que sea.
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  let intPart: string
  let decPart: string | null = null
  if (firstDot === -1) {
    intPart = cleaned
  } else {
    intPart = cleaned.slice(0, firstDot)
    decPart = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  }
  if (!intPart) intPart = '0'
  const intNum = parseInt(intPart, 10)
  const intFmt = Number.isFinite(intNum) ? intNum.toLocaleString('en-US') : intPart
  return decPart !== null ? `${intFmt}.${decPart}` : intFmt
}
