'use client'

import Link from 'next/link'
import { ArrowRight, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'
import { useFormatMoney, useFormatMoneyShort } from './CurrencyProvider'
import { MONTH_NAMES_SHORT } from '@/lib/dates'

export interface UpcomingItem {
  id: string
  date: string // YYYY-MM-DD
  payeeName: string | null
  categoryName: string | null
  accountName: string
  amount: number // signed; negative = outflow
  frequency: string
}

interface UpcomingCommitmentsProps {
  items: UpcomingItem[]
  /** Today's cash + sum(upcoming amounts), already rounded. */
  projectedCash: number
  /** Pure sum of upcoming amounts (signed). */
  netFlow: number
}

const FREQUENCY_LABEL: Record<string, string> = {
  once: 'Una vez',
  daily: 'Diaria',
  weekly: 'Semanal',
  every2weeks: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const formatShortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTH_NAMES_SHORT[m - 1]}`
}

export function UpcomingCommitments({
  items,
  projectedCash,
  netFlow,
}: UpcomingCommitmentsProps) {
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock size={14} strokeWidth={2.2} className="text-[var(--brand-text)] shrink-0" />
          <h2 className="text-body font-semibold text-[var(--text)] truncate">
            Próximos 14 días
          </h2>
        </div>
        <Link
          href="/app/programadas"
          className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0"
        >
          Ver todas
          <ArrowRight size={12} strokeWidth={2.4} />
        </Link>
      </CardHeader>

      {items.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-meta text-[var(--muted)] leading-relaxed">
            No tienes compromisos programados en los próximos 14 días.
          </p>
        </div>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--overlay-1)]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-eyebrow uppercase tracking-[0.15em] text-[var(--muted)] font-semibold">
                Caja proyectada
              </div>
              <div
                className={`text-emph font-bold tabular-nums num ${
                  projectedCash < -0.005 ? 'text-[var(--coral-text)]' : 'gradient-text'
                }`}
              >
                {fmtMoneyShort(projectedCash)}
              </div>
            </div>
            <div className="text-eyebrow text-[var(--muted)] mt-1 num tabular-nums inline-flex items-center gap-1">
              {netFlow < 0 ? (
                <>
                  <TrendingDown size={11} strokeWidth={2.2} className="text-[var(--coral-text)]" />
                  <span>Salidas netas: {fmtMoneyShort(Math.abs(netFlow))}</span>
                </>
              ) : (
                <>
                  <TrendingUp size={11} strokeWidth={2.2} className="text-[var(--brand-text)]" />
                  <span>Entradas netas: {fmtMoneyShort(netFlow)}</span>
                </>
              )}
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)] max-h-[280px] overflow-y-auto">
            {items.slice(0, 8).map((it) => {
              const isOutflow = it.amount < 0
              return (
                <li
                  key={it.id}
                  className="px-5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-[var(--text)] truncate font-medium">
                      {it.payeeName ?? 'Sin nombre'}
                    </div>
                    <div className="text-[10.5px] text-[var(--muted)] truncate inline-flex items-center gap-1">
                      <span className="text-[var(--text2)]">{formatShortDate(it.date)}</span>
                      <span className="text-[var(--muted2)]">·</span>
                      <span>{FREQUENCY_LABEL[it.frequency] ?? it.frequency}</span>
                      {it.categoryName && (
                        <>
                          <span className="text-[var(--muted2)]">·</span>
                          <span>{it.categoryName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-body-sm font-semibold tabular-nums num shrink-0 ${
                      isOutflow ? 'text-[var(--coral-text)]' : 'text-[var(--brand-text)]'
                    }`}
                  >
                    {fmtMoney(it.amount)}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
