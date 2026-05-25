'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Sparkles,
  CalendarRange,
} from 'lucide-react'
import { PlanTabs } from './PlanTabs'
import { ExtraordinaryPaymentModal } from './ExtraordinaryPaymentModal'
import { useFormatMoney, useFormatMoneyShort } from '../CurrencyProvider'
import { MONTH_NAMES_SHORT } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { deleteScheduled } from '../programadas/actions'
import { useTransition } from 'react'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

export interface AnnualOneOff {
  id: string
  /** YYYY-MM-DD */
  date: string
  payeeName: string | null
  categoryName: string | null
  accountName: string | null
  /** signed (+ income, − expense) */
  amount: number
}

interface MonthBucket {
  monthIso: string // YYYY-MM
  monthNum: number // 1..12
  monthLabel: string
  totalAssigned: number
  oneOffs: AnnualOneOff[]
  oneOffsExpense: number
  oneOffsIncome: number
}

interface PlanAnnualViewProps {
  year: number
  accounts: AccountOption[]
  categories: CategoryOption[]
  months: MonthBucket[]
}

// Importado de lib/dates — antes era una copia local más.

export function PlanAnnualView({
  year,
  accounts,
  categories,
  months,
}: PlanAnnualViewProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()
  const confirm = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultMonth, setDefaultMonth] = useState<number | undefined>(undefined)
  const [deletingPending, startDelete] = useTransition()

  const totalAssignedYear = months.reduce((s, m) => s + m.totalAssigned, 0)
  const totalOneOffExpense = months.reduce((s, m) => s + m.oneOffsExpense, 0)
  const totalOneOffIncome = months.reduce((s, m) => s + m.oneOffsIncome, 0)
  const yearOutflow = totalAssignedYear + totalOneOffExpense

  const handleAddForMonth = (monthNum: number) => {
    setDefaultMonth(monthNum)
    setModalOpen(true)
  }

  const handleAddGeneric = () => {
    setDefaultMonth(undefined)
    setModalOpen(true)
  }

  const handleDelete = async (oneOff: AnnualOneOff) => {
    const ok = await confirm({
      title: '¿Eliminar este pago extraordinario?',
      description: `${oneOff.payeeName ?? 'Pago'} · ${fmtMoney(Math.abs(oneOff.amount))}. La transacción programada se borra; las transacciones reales que ya hayas registrado se mantienen.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    startDelete(async () => {
      await deleteScheduled(oneOff.id)
      router.refresh()
    })
  }

  return (
    <>
      <div className="space-y-7">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <PageHeader
                eyebrow="Plan · Anual"
                description="Programa pagos extraordinarios (seguros, matrículas, primas) y planifica asignaciones por mes para todo el año."
              >
                Tu año en <span className="gradient-text">una mirada</span>.
              </PageHeader>
            </div>
            <button
              type="button"
              onClick={handleAddGeneric}
              className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0"
            >
              <Plus size={14} strokeWidth={2.4} />
              Pago extraordinario
            </button>
          </div>

          {/* Tabs + Year picker */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PlanTabs view="anual" />
            <YearPicker year={year} />
          </div>
        </div>

        {/* Year totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Asignado total"
            value={fmtMoneyShort(totalAssignedYear)}
            sub="12 meses de presupuesto"
          />
          <KpiCard
            label="Pagos extraordinarios"
            value={fmtMoneyShort(totalOneOffExpense)}
            sub={`${months.reduce((s, m) => s + m.oneOffs.filter((o) => o.amount < 0).length, 0)} programados`}
            tone="warn"
          />
          <KpiCard
            label="Ingresos extra"
            value={fmtMoneyShort(totalOneOffIncome)}
            sub={`${months.reduce((s, m) => s + m.oneOffs.filter((o) => o.amount > 0).length, 0)} programados`}
            tone="brand"
          />
          <KpiCard
            label="Salida total estimada"
            value={fmtMoneyShort(yearOutflow)}
            sub="Asignado + extras"
          />
        </div>

        {/* 12 meses */}
        <div className="space-y-3">
          {months.map((m) => {
            const monthHasItems = m.oneOffs.length > 0 || m.totalAssigned > 0
            return (
              <div
                key={m.monthIso}
                className={`rounded-2xl border ${
                  monthHasItems
                    ? 'border-[var(--border)] bg-[var(--s1)]'
                    : 'border-dashed border-[var(--border3)] bg-transparent'
                } overflow-hidden`}
              >
                <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[var(--border)]/60">
                  <Link
                    href={`/app/plan?month=${m.monthIso}`}
                    prefetch
                    className="inline-flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--overlay-1)] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold leading-none">
                        {MONTH_NAMES_SHORT[m.monthNum - 1]}
                      </span>
                      <span className="text-[14px] font-bold text-[var(--text)] leading-none tabular-nums">
                        {year}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--text)]">
                        {m.monthLabel}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        Asignado: {fmtMoney(m.totalAssigned)}
                        {m.oneOffs.length > 0 && (
                          <span className="text-[var(--text2)]">
                            {' '}
                            · {m.oneOffs.length} extraordinari
                            {m.oneOffs.length === 1 ? 'o' : 'os'}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleAddForMonth(m.monthNum)}
                    aria-label={`Añadir pago extraordinario en ${m.monthLabel}`}
                    title="Añadir pago extraordinario"
                    className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center transition-colors shrink-0"
                  >
                    <Plus size={14} strokeWidth={2.4} />
                  </button>
                </div>

                {m.oneOffs.length > 0 && (
                  <ul className="divide-y divide-[var(--border)]/40">
                    {m.oneOffs.map((o) => {
                      const isIncome = o.amount > 0
                      return (
                        <li
                          key={o.id}
                          className="px-5 py-3 grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center"
                        >
                          <div className="text-[11px] text-[var(--muted)] tabular-nums num w-10">
                            {formatDayDate(o.date)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] text-[var(--text)] font-medium truncate flex items-center gap-1.5">
                              {isIncome ? (
                                <ArrowUpRight
                                  size={12}
                                  strokeWidth={2.4}
                                  className="text-[var(--brand-text)] shrink-0"
                                />
                              ) : (
                                <ArrowDownRight
                                  size={12}
                                  strokeWidth={2.4}
                                  className="text-[var(--coral-text)] shrink-0"
                                />
                              )}
                              {o.payeeName ?? 'Pago programado'}
                            </div>
                            <div className="text-[11px] text-[var(--muted)] truncate">
                              {[o.categoryName, o.accountName].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                          <div
                            className={`text-[13px] tabular-nums num font-semibold ${
                              isIncome ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                            }`}
                          >
                            {isIncome ? '+' : '−'}
                            {fmtMoney(Math.abs(o.amount))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(o)}
                            disabled={deletingPending}
                            aria-label="Eliminar pago"
                            className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)] flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {m.oneOffs.length === 0 && (
                  <div className="px-5 py-3 text-[12px] text-[var(--muted)] inline-flex items-center gap-2">
                    <Sparkles size={11} strokeWidth={2.2} />
                    Sin pagos extraordinarios.{' '}
                    <Link
                      href={`/app/plan?month=${m.monthIso}`}
                      prefetch
                      className="text-[var(--brand-text)] hover:underline underline-offset-4"
                    >
                      Editar asignaciones de {MONTH_NAMES_SHORT[m.monthNum - 1]}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--overlay-1)] px-5 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--s1)] flex items-center justify-center shrink-0 text-[var(--text2)]">
            <CalendarRange size={16} strokeWidth={2} />
          </div>
          <div className="text-[12px] text-[var(--muted)] leading-relaxed">
            <span className="text-[var(--text2)] font-medium">¿Necesitas asignar más a una categoría en un mes específico?</span>{' '}
            Haz click en cualquier mes para abrir su vista mensual y ajustar las
            asignaciones por categoría.
          </div>
        </div>
      </div>

      <ExtraordinaryPaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        year={year}
        defaultMonth={defaultMonth}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}

function YearPicker({ year }: { year: number }) {
  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/app/plan?view=anual&year=${year - 1}`}
        prefetch
        aria-label="Año anterior"
        className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={2.2} />
      </Link>
      <div className="min-w-[80px] px-3 py-2 text-center text-[14px] font-semibold text-[var(--text)] tabular-nums num">
        {year}
      </div>
      <Link
        href={`/app/plan?view=anual&year=${year + 1}`}
        prefetch
        aria-label="Año siguiente"
        className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text2)] hover:text-[var(--text)] flex items-center justify-center transition-colors"
      >
        <ChevronRight size={16} strokeWidth={2.2} />
      </Link>
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'brand' | 'warn'
}) {
  const valueTone =
    tone === 'brand'
      ? 'text-[var(--brand-text)]'
      : tone === 'warn'
        ? 'text-[var(--warn-text)]'
        : 'text-[var(--text)]'
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
        {label}
      </div>
      <div className={`text-[20px] font-bold tabular-nums num mt-1 ${valueTone}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[var(--muted)] mt-0.5">{sub}</div>
      )}
    </div>
  )
}

const formatDayDate = (iso: string) => {
  const [, , d] = iso.split('-').map(Number)
  return String(d).padStart(2, '0')
}
