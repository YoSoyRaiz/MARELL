'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  formatMoney as fmt,
  formatMoneyShort as fmtShort,
  parseCurrency,
  type Currency,
} from '@/lib/money'

interface Ctx {
  currency: Currency
  /** Pre-bound formatter so call sites can do `fmtMoney(n)` like before. */
  fmtMoney: (n: number) => string
  fmtMoneyShort: (n: number) => string
}

const CurrencyCtx = createContext<Ctx | null>(null)

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string | null | undefined
  children: ReactNode
}) {
  const value = useMemo<Ctx>(() => {
    const c = parseCurrency(currency)
    return {
      currency: c,
      fmtMoney: (n: number) => fmt(n, c),
      fmtMoneyShort: (n: number) => fmtShort(n, c),
    }
  }, [currency])

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>
}

/**
 * Returns a stable money formatter bound to the user's budget currency.
 * Falls back to DOP if no provider is mounted (e.g. on a public route).
 */
export function useFormatMoney(): Ctx['fmtMoney'] {
  const ctx = useContext(CurrencyCtx)
  if (ctx) return ctx.fmtMoney
  return (n: number) => fmt(n, 'DOP')
}

export function useFormatMoneyShort(): Ctx['fmtMoneyShort'] {
  const ctx = useContext(CurrencyCtx)
  if (ctx) return ctx.fmtMoneyShort
  return (n: number) => fmtShort(n, 'DOP')
}

export function useCurrency(): Currency {
  const ctx = useContext(CurrencyCtx)
  return ctx?.currency ?? 'DOP'
}
