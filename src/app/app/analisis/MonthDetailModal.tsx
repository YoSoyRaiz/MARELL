'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowRight, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { ModalHeader, ModalTitle } from '@/components/ui/ModalHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useFormatMoney } from '../CurrencyProvider'
import { fetchMonthDetail, type MonthDetailTxn } from './actions'

interface Props {
  /** YYYY-MM del mes a mostrar. null = modal cerrado. */
  month: string | null
  /** Label legible ('Abril 2026'). Lo pasa el padre para evitar re-
   *  parsear y para que el header del modal aparezca instantáneo
   *  mientras carga la data del server. */
  monthLabel: string
  onClose: () => void
}

/**
 * Modal de detalle de un mes en Ingresos vs Gastos.
 *
 * Se abre al click en una fila del Detalle. Fetch lazy on-open al
 * server action fetchMonthDetail() — no preloadeamos las 12 listas
 * porque el usuario raramente las quiere ver todas, y cada una son
 * ~50-500 txns.
 */
export function MonthDetailModal({ month, monthLabel, onClose }: Props) {
  const fmtMoney = useFormatMoney()
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMonthDetail>> | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!month) {
      setData(null)
      return
    }
    setLoading(true)
    fetchMonthDetail(month)
      .then((r) => setData(r))
      .finally(() => setLoading(false))
  }, [month])

  const isOpen = month !== null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="month-detail-title"
      maxHeight="92vh"
      scrollable
    >
      <ModalHeader onClose={onClose}>
        <ModalTitle
          id="month-detail-title"
          size="compact"
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Calendar size={12} strokeWidth={2.4} />
              Detalle del mes
            </span>
          }
          description={
            data?.summary
              ? `${data.summary.txnCount} ${data.summary.txnCount === 1 ? 'transacción' : 'transacciones'} · ingresos y gastos del período`
              : 'Cargando…'
          }
        >
          {monthLabel}
        </ModalTitle>
      </ModalHeader>

      {loading || !data ? (
        <div className="px-6 py-10 text-center text-body-sm text-[var(--muted)] inline-flex items-center justify-center gap-2 w-full">
          <Spinner />
          Cargando transacciones…
        </div>
      ) : data.error ? (
        <div className="px-6 py-10 text-center text-body-sm text-[var(--coral-text)]">
          {data.error}
        </div>
      ) : !data.summary ? null : (
        <div className="px-6 py-5 space-y-5">
          {/* Summary stat trio */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat
              label="Ingresos"
              value={fmtMoney(data.summary.income)}
              tone="brand"
              Icon={ArrowUp}
            />
            <SummaryStat
              label="Gastos"
              value={fmtMoney(data.summary.expense)}
              tone="coral"
              Icon={ArrowDown}
            />
            <SummaryStat
              label="Neto"
              value={fmtMoney(data.summary.net)}
              tone={data.summary.net >= 0 ? 'brand' : 'coral'}
            />
          </div>

          {/* Income list */}
          {data.income && data.income.length > 0 && (
            <Section
              title="Ingresos"
              count={data.income.length}
              tone="brand"
              txns={data.income}
              fmtMoney={fmtMoney}
            />
          )}

          {/* Expense list */}
          {data.expense && data.expense.length > 0 && (
            <Section
              title="Gastos"
              count={data.expense.length}
              tone="coral"
              txns={data.expense}
              fmtMoney={fmtMoney}
            />
          )}

          {data.summary.txnCount === 0 && (
            <div className="text-center text-body-sm text-[var(--muted)] py-6">
              No hay transacciones en este mes.
            </div>
          )}

          {/* Footer link a /transacciones filtrado por este mes para
              editar/eliminar (el modal es read-only para mantenerlo
              ligero y enfocado en review). */}
          {month && (
            <div className="pt-2 border-t border-[var(--border)] text-center">
              <Link
                href={`/app/transacciones?month=${month}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-meta font-medium text-[var(--brand-text)] hover:underline underline-offset-4"
              >
                Ver y editar en Transacciones
                <ArrowRight size={12} strokeWidth={2.4} />
              </Link>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function SummaryStat({
  label,
  value,
  tone,
  Icon,
}: {
  label: string
  value: string
  tone: 'brand' | 'coral'
  Icon?: typeof ArrowUp
}) {
  const valueClass =
    tone === 'brand' ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--overlay-1)] px-3 py-2.5">
      <div className="inline-flex items-center gap-1.5 text-tiny uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold">
        {Icon && <Icon size={11} strokeWidth={2.4} className={valueClass} />}
        {label}
      </div>
      <div className={`text-emph font-bold tabular-nums num mt-1 ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  tone,
  txns,
  fmtMoney,
}: {
  title: string
  count: number
  tone: 'brand' | 'coral'
  txns: MonthDetailTxn[]
  fmtMoney: (n: number) => string
}) {
  const titleColor =
    tone === 'brand' ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-meta font-semibold uppercase tracking-[0.18em] ${titleColor}`}>
          {title}
        </h3>
        <span className="text-eyebrow text-[var(--muted)] tabular-nums">
          {count}
        </span>
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 overflow-hidden">
        {txns.map((t) => (
          <li
            key={t.id}
            className="px-3 py-2.5 grid grid-cols-[1fr_auto] gap-3 items-center"
          >
            <div className="min-w-0">
              <div className="text-body-sm text-[var(--text)] truncate font-medium">
                {t.payeeName || 'Sin nombre'}
              </div>
              <div className="text-tiny text-[var(--muted)] truncate mt-0.5">
                {t.date} · {t.categoryName ?? 'Sin categoría'} · {t.accountName}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-body-sm font-semibold tabular-nums num ${
                  t.amountDOP > 0
                    ? 'text-[var(--brand-text)]'
                    : 'text-[var(--coral-text)]'
                }`}
              >
                {fmtMoney(t.amountDOP)}
              </div>
              {t.nativeCurrency !== 'DOP' && (
                <div className="text-tiny text-[var(--muted2)] tabular-nums">
                  {t.nativeCurrency} {t.amountNative.toFixed(2)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
