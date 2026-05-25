'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MONTH_NAMES_SHORT_LOWER } from '@/lib/dates'
import { useFormatMoney } from '../CurrencyProvider'

interface AccountTxRow {
  id: string
  date: string
  payeeName: string
  categoryName: string | null
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

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, , mm, dd] = m
  const monthIdx = parseInt(mm, 10) - 1
  return `${parseInt(dd, 10)} ${MONTH_NAMES_SHORT_LOWER[monthIdx] ?? ''}`.trim()
}

/**
 * Inline panel shown under an account row when the user taps it. Lazy-
 * loads the last 8 transactions for that account so the parent page
 * doesn't have to over-fetch when most accounts are collapsed.
 *
 * Layout mimica un estado de cuenta bancario: fecha, comercio +
 * categoría, monto a la derecha en color signed.
 */
export function AccountTransactionsDropdown({ accountId, open, currency }: Props) {
  const [rows, setRows] = useState<AccountTxRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const fmtDop = useFormatMoney()

  // Format USD with US$ prefix; DOP goes through the user's currency
  // formatter which already uses the configured locale.
  const formatAmount = (amount: number) => {
    if (currency === 'USD') {
      const sign = amount < 0 ? '−' : '+'
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
      // Join with categories so we can show the category name like a
      // bank statement does ("Comida · Supermercado Nacional").
      const { data } = await supabase
        .from('transactions')
        .select(
          'id, date, payee_name, amount, categories(name)',
        )
        .eq('account_id', accountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)
      if (cancelled) return
      const list: AccountTxRow[] = (data ?? []).map((t) => {
        const r = t as Record<string, unknown>
        const cat = r.categories as { name?: string } | null
        return {
          id: r.id as string,
          date: r.date as string,
          payeeName: (r.payee_name as string | null) ?? '',
          categoryName: cat?.name ?? null,
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
    <div className="px-5 pb-4 pt-1 bg-[var(--overlay-1)]">
      {loading && rows === null ? (
        <div className="py-4 text-center text-meta text-[var(--muted)]">
          Cargando transacciones…
        </div>
      ) : rows && rows.length > 0 ? (
        <>
          <div className="flex items-center justify-between py-2">
            <div className="text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted2)]">
              Últimas transacciones
            </div>
            <Link
              href={`/app/transacciones?account=${accountId}&new=1`}
              className="text-eyebrow font-medium text-[var(--brand-text)] hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              <Plus size={11} strokeWidth={2.4} />
              Agregar
            </Link>
          </div>
          <ul className="rounded-xl border border-[var(--border)] bg-[var(--s1)] divide-y divide-[var(--border)]">
            {rows.map((t) => {
              const isIncome = t.amount > 0
              const isTransfer = t.payeeName.startsWith('Transferencia')
              const Icon = isTransfer
                ? ArrowLeftRight
                : isIncome
                  ? ArrowUpRight
                  : ArrowDownRight
              const iconColor = isTransfer
                ? 'text-[var(--info-text)] bg-[rgba(77,168,255,0.10)]'
                : isIncome
                  ? 'text-[var(--brand-text)] bg-[rgba(61,220,151,0.10)]'
                  : 'text-[var(--coral-text)] bg-[rgba(255,122,89,0.10)]'
              return (
                <li
                  key={t.id}
                  className="px-3 py-2.5 grid grid-cols-[36px_60px_1fr_auto] items-center gap-3"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}
                  >
                    <Icon size={14} strokeWidth={2.2} />
                  </div>
                  <div className="text-eyebrow font-medium text-[var(--muted)] num tabular-nums">
                    {formatShortDate(t.date)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-body-sm text-[var(--text)] truncate">
                      {t.payeeName || 'Sin descripción'}
                    </div>
                    <div className="text-eyebrow text-[var(--muted)] truncate">
                      {t.categoryName ?? (isTransfer ? 'Transferencia' : 'Sin categoría')}
                    </div>
                  </div>
                  <div
                    className={`text-body-sm font-semibold tabular-nums num text-right ${
                      isIncome
                        ? 'text-[var(--brand-text)]'
                        : 'text-[var(--text)]'
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
            className="mt-3 inline-flex items-center gap-1.5 text-meta font-medium text-[var(--brand-text)] hover:underline underline-offset-4"
          >
            Ver todas las transacciones de esta cuenta
            <ArrowRight size={11} strokeWidth={2.4} />
          </Link>
        </>
      ) : (
        <div className="py-6 text-center space-y-3">
          <p className="text-meta text-[var(--muted)]">
            Esta cuenta aún no tiene transacciones.
          </p>
          <Link
            href={`/app/transacciones?account=${accountId}&new=1`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-[var(--border2)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-2)] text-[var(--text)] text-meta font-medium transition-colors"
          >
            <Plus size={12} strokeWidth={2.4} />
            Agregar transacción
          </Link>
        </div>
      )}
    </div>
  )
}
