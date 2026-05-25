'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Calendar,
  Repeat,
  Pause,
  Play,
  Pencil,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFormatMoney } from '../CurrencyProvider'
import {
  ScheduledFormModal,
  type InitialScheduled,
} from './ScheduledFormModal'
import {
  deleteScheduled,
  toggleScheduledActive,
  type Frequency,
  type ScheduledType,
} from './actions'

const FREQ_LABELS: Record<Frequency, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
  every2weeks: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}


const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

const formatNextDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = date.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays > 0 && diffDays <= 7) return `En ${diffDays} días`
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)} d`
  const sameYear = date.getFullYear() === today.getFullYear()
  return sameYear
    ? `${date.getDate()} ${MONTHS[date.getMonth()]}`
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export interface ListScheduled {
  id: string
  accountId: string
  accountName: string
  categoryId: string | null
  categoryName: string | null
  groupName: string | null
  payeeName: string
  memo: string | null
  amount: number
  type: ScheduledType
  frequency: Frequency
  nextDate: string
  active: boolean
}

type Filter = 'todas' | 'activas' | 'pausadas'

interface Props {
  scheduled: ListScheduled[]
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string; group_name: string }[]
  hasBudget: boolean
}

export function ProgramadasClient({
  scheduled,
  accounts,
  categories,
  hasBudget,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const [, startMutate] = useTransition()
  const [filter, setFilter] = useState<Filter>('todas')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ListScheduled | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'activas') return scheduled.filter((s) => s.active)
    if (filter === 'pausadas') return scheduled.filter((s) => !s.active)
    return scheduled
  }, [scheduled, filter])

  // Forecast next 30 days for active schedules.
  const next30 = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 30)
    let income = 0
    let expense = 0
    for (const s of scheduled) {
      if (!s.active) continue
      const [y, m, d] = s.nextDate.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      // Walk forward up to horizon, summing recurrences
      const cursor = new Date(start)
      let safety = 0
      while (cursor.getTime() <= horizon.getTime() && safety < 64) {
        if (cursor.getTime() >= today.getTime()) {
          if (s.type === 'income') income += s.amount
          else expense += s.amount
        }
        if (s.frequency === 'once') break
        switch (s.frequency) {
          case 'daily':
            cursor.setDate(cursor.getDate() + 1)
            break
          case 'weekly':
            cursor.setDate(cursor.getDate() + 7)
            break
          case 'every2weeks':
            cursor.setDate(cursor.getDate() + 14)
            break
          case 'monthly':
            cursor.setMonth(cursor.getMonth() + 1)
            break
          case 'yearly':
            cursor.setFullYear(cursor.getFullYear() + 1)
            break
        }
        safety += 1
      }
    }
    return { income, expense, net: income - expense }
  }, [scheduled])

  const handleToggle = (s: ListScheduled) => {
    startMutate(async () => {
      await toggleScheduledActive(s.id, !s.active)
      router.refresh()
    })
  }

  const handleDelete = async (s: ListScheduled) => {
    const ok = await confirm({
      title: `¿Eliminar "${s.payeeName}"?`,
      description:
        'Se borra solo la recurrencia. Las transacciones ya creadas se mantienen.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    startMutate(async () => {
      await deleteScheduled(s.id)
      router.refresh()
    })
  }

  const handleClose = () => {
    setAddOpen(false)
    setEditing(null)
  }

  const isEmpty = scheduled.length === 0
  const noAccounts = accounts.length === 0

  return (
    <>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PageHeader
              eyebrow="Programadas"
              description={
                isEmpty
                  ? 'Programa transacciones recurrentes (alquiler, sueldo, suscripciones) y MARELL las crea por ti cada vez que toca.'
                  : `${scheduled.length} ${scheduled.length === 1 ? 'recurrencia configurada' : 'recurrencias configuradas'}.`
              }
            >
              Lo que <span className="gradient-text">se repite</span>.
            </PageHeader>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!hasBudget || noAccounts}
            className="h-10 sm:h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none self-start sm:self-auto"
            title={noAccounts ? 'Necesitas al menos una cuenta abierta' : undefined}
          >
            <Plus size={14} strokeWidth={2.4} />
            Programar
          </button>
        </div>

        {/* 30-day forecast */}
        {!isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ForecastCard
              label="Ingresos próximos 30d"
              value={fmtMoney(next30.income)}
              Icon={ArrowUpRight}
              tone="positive"
            />
            <ForecastCard
              label="Gastos próximos 30d"
              value={fmtMoney(next30.expense)}
              Icon={ArrowDownRight}
              tone="negative"
            />
            <ForecastCard
              label="Flujo neto 30d"
              value={`${next30.net < 0 ? '−' : ''}${fmtMoney(next30.net)}`}
              Icon={Repeat}
              tone={next30.net >= 0 ? 'positive' : 'negative'}
            />
          </div>
        )}

        {isEmpty && (
          <EmptyState
            Icon={Repeat}
            title="Aún sin recurrencias"
            description="Agrega lo que pagas o cobras siempre: sueldo, alquiler, Netflix, gimnasio. MARELL crea cada movimiento automáticamente cuando toca."
            action={
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                disabled={!hasBudget || noAccounts}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl gradient-bg text-[#0B0B0C] font-semibold text-[13px] glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-[filter]"
              >
                <Plus size={14} strokeWidth={2.4} />
                Programar primera
              </button>
            }
          />
        )}

        {!isEmpty && (
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            ariaLabel="Filtro de programadas"
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'activas', label: 'Activas' },
              { value: 'pausadas', label: 'Pausadas' },
            ]}
          />
        )}

        {/* List */}
        {!isEmpty && filtered.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-10 text-center">
            <div className="text-[var(--text2)] text-[14px]">
              Sin recurrencias en este filtro.
            </div>
          </div>
        )}

        {!isEmpty && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((s) => {
              const Icon = iconForCategoryName(s.categoryName ?? s.payeeName)
              const isIncome = s.type === 'income'
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border bg-[var(--s1)] p-5 transition-colors space-y-4 ${
                    s.active
                      ? 'border-[var(--border)] hover:border-[var(--border3)]'
                      : 'border-[var(--border)] opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-[rgba(61,220,151,0.14)] text-[var(--brand-text)]'
                          : 'bg-[var(--overlay-1)] text-[var(--text2)]'
                      }`}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--text)] truncate">
                        {s.payeeName}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] truncate inline-flex items-center gap-1.5">
                        <span>{s.accountName}</span>
                        {s.categoryName && (
                          <>
                            <span className="text-[var(--muted2)]">·</span>
                            <span>{s.categoryName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-[16px] font-bold tabular-nums num shrink-0 ${
                        isIncome ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {isIncome ? '+' : '−'}
                      {fmtMoney(s.amount)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
                    <div className="inline-flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Repeat size={12} strokeWidth={2} />
                        {FREQ_LABELS[s.frequency]}
                      </span>
                      <span className="text-[var(--muted2)]">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={2} />
                        {s.active ? formatNextDate(s.nextDate) : 'Pausada'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(s)}
                        aria-label={s.active ? 'Pausar' : 'Reanudar'}
                        title={s.active ? 'Pausar' : 'Reanudar'}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
                      >
                        {s.active ? (
                          <Pause size={14} strokeWidth={2} />
                        ) : (
                          <Play size={14} strokeWidth={2} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        aria-label={`Editar ${s.payeeName}`}
                        title="Editar"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        aria-label={`Eliminar ${s.payeeName}`}
                        title="Eliminar"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)] transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ScheduledFormModal
        isOpen={addOpen || editing !== null}
        onClose={handleClose}
        accounts={accounts}
        categories={categories}
        mode={editing ? 'edit' : 'add'}
        initial={
          editing
            ? ({
                id: editing.id,
                type: editing.type,
                accountId: editing.accountId,
                categoryId: editing.categoryId,
                payeeName: editing.payeeName,
                amount: editing.amount,
                memo: editing.memo,
                frequency: editing.frequency,
                nextDate: editing.nextDate,
              } satisfies InitialScheduled)
            : undefined
        }
      />
    </>
  )
}

interface ForecastCardProps {
  label: string
  value: string
  Icon: typeof Repeat
  tone: 'positive' | 'negative'
}

function ForecastCard({ label, value, Icon, tone }: ForecastCardProps) {
  const isPositive = tone === 'positive'
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isPositive
              ? 'bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)]'
              : 'bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)]'
          }`}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div
        className={`text-[20px] font-bold tabular-nums num leading-none ${
          isPositive ? 'gradient-text' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
    </Card>
  )
}
