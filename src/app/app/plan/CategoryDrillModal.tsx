'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  TrendingDown,
  TrendingUp,
  CalendarRange,
} from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import {
  fetchCategoryHistory,
  type CategoryHistoryMonth,
  type CategoryHistoryTxn,
} from './actions'
import { useFormatMoney, useFormatMoneyShort } from '../CurrencyProvider'
import { MONTH_NAMES_SHORT } from '@/lib/dates'
import { ModalHeader } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { IconBadge } from '@/components/ui/IconBadge'

interface CategoryDrillModalProps {
  isOpen: boolean
  onClose: () => void
  categoryId: string
}

interface LoadedHistory {
  category: {
    id: string
    name: string
    groupName: string
    goalAmount: number | null
    goalType: string | null
    goalDate: string | null
  }
  months: CategoryHistoryMonth[]
  transactions: CategoryHistoryTxn[]
  totals: {
    assigned: number
    spent: number
    available: number
    avgMonthlySpend: number
    monthsWithActivity: number
  }
}

const formatMonthLabel = (yyyymm: string) => {
  const [, m] = yyyymm.split('-').map(Number)
  return MONTH_NAMES_SHORT[m - 1] ?? '—'
}

const formatTxnDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTH_NAMES_SHORT[m - 1]}`
}

export function CategoryDrillModal({
  isOpen,
  onClose,
  categoryId,
}: CategoryDrillModalProps) {
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()
  const [data, setData] = useState<LoadedHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setData(null)
    setError(null)
    setLoading(true)
    fetchCategoryHistory(categoryId, 12)
      .then((r) => {
        if (r.error || !r.category || !r.months || !r.transactions || !r.totals) {
          setError(r.error ?? 'No se pudo cargar el historial')
          return
        }
        setData({
          category: r.category,
          months: r.months,
          transactions: r.transactions,
          totals: r.totals,
        })
      })
      .finally(() => setLoading(false))
  }, [isOpen, categoryId])

  const Icon = data ? iconForCategoryName(data.category.name) : CalendarRange
  // Cap the bar chart Y-axis to whichever is bigger (assigned or spent)
  // across the visible window. Falls back to 1 to avoid divide-by-zero.
  const peak = data
    ? Math.max(
        1,
        ...data.months.map((m) => Math.max(m.assigned, m.spent)),
      )
    : 1

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="drill-title"
      variant="center"
      size="2xl"
    >
      <ModalHeader onClose={onClose}>
          <div className="flex items-start gap-3 min-w-0">
            <IconBadge size="lg">
              <Icon size={18} strokeWidth={2} />
            </IconBadge>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
                {data?.category.groupName ?? '—'}
              </div>
              <h2
                id="drill-title"
                className="text-[20px] font-bold leading-tight tracking-tight truncate"
              >
                {data?.category.name ?? 'Cargando…'}
              </h2>
              {data?.category.goalAmount && data.category.goalAmount > 0 && (
                <div className="text-[11px] text-[var(--muted)] num tabular-nums mt-0.5">
                  Meta:{' '}
                  <span className="text-[var(--text2)]">
                    {fmtMoney(data.category.goalAmount)}
                  </span>
                  {data.category.goalType && (
                    <span className="text-[var(--muted2)]">
                      {' '}
                      · {goalTypeLabel(data.category.goalType)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading && (
            <div className="text-center text-[13px] text-[var(--muted)] py-8">
              Cargando historial…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3 text-[13px]">
              <AlertCircle
                size={16}
                strokeWidth={2}
                className="text-[var(--coral-text)] shrink-0 mt-0.5"
              />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Stats strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Stat
                  label="Total asignado"
                  value={fmtMoneyShort(data.totals.assigned)}
                  hint="últimos 12 meses"
                />
                <Stat
                  label="Total gastado"
                  value={fmtMoneyShort(data.totals.spent)}
                  hint="últimos 12 meses"
                  Icon={TrendingDown}
                  iconColor="text-[var(--coral-text)]"
                />
                <Stat
                  label="Disponible"
                  value={fmtMoneyShort(data.totals.available)}
                  hint="asig − gasto"
                  iconColor={
                    data.totals.available < 0
                      ? 'text-[var(--coral-text)]'
                      : 'text-[var(--brand-text)]'
                  }
                  highlight={
                    data.totals.available < 0 ? 'coral' : 'gradient'
                  }
                />
                <Stat
                  label="Promedio/mes"
                  value={fmtMoneyShort(data.totals.avgMonthlySpend)}
                  hint={`${data.totals.monthsWithActivity} meses con gasto`}
                  Icon={TrendingUp}
                />
              </div>

              {/* Monthly bar chart: assigned vs spent */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[12px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold">
                    12 meses
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[var(--overlay-4)]" />
                      Asignado
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm gradient-bg" />
                      Gastado
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-1.5 items-end h-32">
                  {data.months.map((m) => {
                    const assignedH = Math.max(2, (m.assigned / peak) * 110)
                    const spentH = Math.max(2, (m.spent / peak) * 110)
                    const isLatest =
                      m.month === data.months[data.months.length - 1].month
                    return (
                      <div
                        key={m.month}
                        className="flex flex-col items-center justify-end gap-1"
                        title={`${formatMonthLabel(m.month)}: asignado ${fmtMoneyShort(m.assigned)}, gastado ${fmtMoneyShort(m.spent)}`}
                      >
                        <div className="flex items-end gap-0.5 h-[110px] w-full justify-center">
                          <div
                            className="w-1.5 rounded-t bg-[var(--overlay-4)]"
                            style={{ height: `${assignedH}px` }}
                          />
                          <div
                            className="w-1.5 rounded-t gradient-bg"
                            style={{ height: `${spentH}px` }}
                          />
                        </div>
                        <div
                          className={`text-[9px] uppercase tracking-wider font-semibold ${
                            isLatest ? 'text-[var(--brand-text)]' : 'text-[var(--muted2)]'
                          }`}
                        >
                          {formatMonthLabel(m.month)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent transactions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold">
                    Transacciones
                  </div>
                  <div className="text-[11px] text-[var(--muted2)] num tabular-nums">
                    {data.transactions.length} mostradas
                  </div>
                </div>
                {data.transactions.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-6 text-center text-[12px] text-[var(--muted)]">
                    Sin transacciones para esta categoría todavía.
                  </div>
                ) : (
                  <ul className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] overflow-hidden">
                    {data.transactions.map((t) => (
                      <li
                        key={t.id}
                        className="px-4 py-2.5 flex items-center gap-3"
                      >
                        <div className="w-12 text-[10px] text-[var(--muted2)] tabular-nums shrink-0">
                          {formatTxnDate(t.date)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] text-[var(--text)] truncate">
                            {t.payeeName ?? 'Sin nombre'}
                            {t.isSplit && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--brand-text)]">
                                · split
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[var(--muted)] truncate">
                            {t.accountName}
                            {t.memo && <> · {t.memo}</>}
                          </div>
                        </div>
                        <div
                          className={`text-[12.5px] font-semibold tabular-nums num shrink-0 ${
                            t.amount < 0 ? 'text-[var(--text)]' : 'text-[var(--brand-text)]'
                          }`}
                        >
                          {fmtMoney(t.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
    </Modal>
  )
}

interface StatProps {
  label: string
  value: string
  hint?: string
  Icon?: React.ElementType
  iconColor?: string
  highlight?: 'coral' | 'gradient'
}

function Stat({ label, value, hint, Icon, iconColor, highlight }: StatProps) {
  const valueClass =
    highlight === 'coral'
      ? 'text-[var(--coral-text)]'
      : highlight === 'gradient'
        ? 'gradient-text'
        : 'text-[var(--text)]'
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
          {label}
        </div>
        {Icon && (
          <Icon
            size={11}
            strokeWidth={2.2}
            className={iconColor ?? 'text-[var(--muted2)]'}
          />
        )}
      </div>
      <div className={`text-[15px] font-bold tabular-nums num leading-none ${valueClass}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-[var(--muted2)] mt-0.5">{hint}</div>
      )}
    </div>
  )
}

function goalTypeLabel(t: string): string {
  switch (t) {
    case 'monthly_spending':
      return 'Mensual'
    case 'savings_balance':
      return 'Acumulada'
    case 'needed_by':
      return 'Por fecha'
    default:
      return t
  }
}
