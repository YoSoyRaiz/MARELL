'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFormatMoney } from '../CurrencyProvider'

interface AccountTxRow {
  id: string
  date: string
  payeeName: string
  amount: number
}

interface Props {
  accountId: string
  /** When the parent expands a different row, the unmounted dropdown
   *  shouldn't keep fetching — the effect lifecycle handles that. */
  open: boolean
  /** Account currency, so the formatted amount matches what the user
   *  typed (USD accounts show US$, DOP accounts show RD$). */
  currency: 'DOP' | 'USD'
}

const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, , mm, dd] = m
  const monthIdx = parseInt(mm, 10) - 1
  return `${parseInt(dd, 10)} ${SHORT_MONTHS_ES[monthIdx] ?? ''}`.trim()
}

/**
 * Inline panel shown under an account row when the user taps it. Lazy-
 * loads the last 8 transactions for that account so the parent page
 * doesn't have to over-fetch when most accounts are collapsed.
 */
export function AccountTransactionsDropdown({ accountId, open, currency }: Props) {
  const [rows, setRows] = useState<AccountTxRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const fmtDop = useFormatMoney()

  // Format USD with US$ prefix; DOP goes through the user's currency
  // formatter which already uses the configured locale.
  const formatAmount = (amount: number) => {
    if (currency === 'USD') {
      const sign = amount < 0 ? '-' : '+'
      return `${sign}US$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    const sign = amount < 0 ? '' : '+'
    return `${sign}${fmtDop(amount)}`
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('transactions')
        .select('id, date, payee_name, amount')
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8)
      if (cancelled) return
      const list: AccountTxRow[] = (data ?? []).map((t) => {
        const r = t as Record<string, unknown>
        return {
          id: r.id as string,
          date: r.date as string,
          payeeName: (r.payee_name as string | null) ?? '',
          amount: Number(r.amount),
        }
      })
      setRows(list)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accountId, open])

  if (!open) return null

  return (
    <div className="px-5 pb-4 pt-1 bg-black/[0.15]">
      {loading && rows === null ? (
        <div className="py-4 text-center text-[12px] text-[var(--muted)]">
          Cargando transacciones…
        </div>
      ) : rows && rows.length > 0 ? (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted2)] py-2">
            Últimas transacciones
          </div>
          <ul className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 divide-y divide-[var(--border)]">
            {rows.map((t) => {
              const isIncome = t.amount > 0
              const Icon = t.payeeName.startsWith('Transferencia')
                ? ArrowLeftRight
                : isIncome
                  ? ArrowUpRight
                  : ArrowDownRight
              const iconColor = isIncome
                ? 'text-[var(--brand-text)]'
                : 'text-[var(--coral-text)]'
              return (
                <li
                  key={t.id}
                  className="px-3 py-2.5 grid grid-cols-[28px_1fr_auto] items-center gap-3"
                >
                  <Icon size={14} strokeWidth={2.2} className={iconColor} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-[var(--text)] truncate">
                      {t.payeeName || 'Sin descripción'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] num tabular-nums">
                      {formatShortDate(t.date)}
                    </div>
                  </div>
                  <div
                    className={`text-[13px] font-semibold tabular-nums num ${
                      isIncome ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                    }`}
                  >
                    {formatAmount(t.amount)}
                  </div>
                </li>
              )
            })}
          </ul>
          <Link
            href={`/app/transacciones?account=${accountId}`}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand-text)] hover:underline underline-offset-4"
          >
            Ver todas las transacciones de esta cuenta
            <ArrowRight size={11} strokeWidth={2.4} />
          </Link>
        </>
      ) : (
        <div className="py-4 text-center text-[12px] text-[var(--muted)]">
          Esta cuenta aún no tiene transacciones.
        </div>
      )}
    </div>
  )
}
