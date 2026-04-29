'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Target,
  Calendar,
  CheckCircle2,
  Repeat,
  PiggyBank,
  Trash2,
} from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import {
  GoalFormModal,
  type CategoryOption,
  type InitialGoal,
} from './GoalFormModal'
import { clearGoal, type GoalType } from './actions'

const fmtMoney = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (n < -0.005) return `−$${formatted}`
  return `$${formatted}`
}

const fmtMoneyShort = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `$${formatted}`
}

const formatGoalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

const monthsUntil = (iso: string): number => {
  const [y, m] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, 1)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth())
}

export interface ListGoal {
  categoryId: string
  categoryName: string
  groupName: string
  goalType: GoalType
  goalAmount: number
  goalDate: string | null
  // For monthly_spending: current month's assignment
  // For savings_balance: lifetime assigned − lifetime spent
  current: number
}

interface Props {
  goals: ListGoal[]
  availableCategories: CategoryOption[]
  hasBudget: boolean
}

export function MetasClient({ goals, availableCategories, hasBudget }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ListGoal | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deletingId, startDelete] = useTransition()

  const handleDelete = (categoryId: string) => {
    if (confirmingDelete !== categoryId) {
      setConfirmingDelete(categoryId)
      window.setTimeout(() => {
        setConfirmingDelete((curr) => (curr === categoryId ? null : curr))
      }, 3000)
      return
    }
    startDelete(async () => {
      const result = await clearGoal(categoryId)
      if (result && 'error' in result && result.error) {
        setConfirmingDelete(null)
        return
      }
      setConfirmingDelete(null)
      router.refresh()
    })
  }

  const isEmpty = goals.length === 0

  // KPIs
  const totalGoalAmount = goals.reduce((s, g) => s + g.goalAmount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.current, 0)
  const completed = goals.filter((g) => g.current >= g.goalAmount - 0.005).length
  const inProgress = goals.length - completed

  const sortedGoals = [...goals].sort((a, b) => {
    const pa = a.goalAmount > 0 ? a.current / a.goalAmount : 0
    const pb = b.goalAmount > 0 ? b.current / b.goalAmount : 0
    if (pa !== pb) return pb - pa // higher progress first
    return a.categoryName.localeCompare(b.categoryName)
  })

  const handleClose = () => {
    setAddOpen(false)
    setEditing(null)
  }

  return (
    <>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Metas
            </div>
            <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
              Hacia dónde va tu <span className="gradient-text">esfuerzo</span>.
            </h1>
            <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
              {isEmpty
                ? 'Aún no has definido metas. Crea la primera para empezar a trackear progreso.'
                : `${goals.length} ${goals.length === 1 ? 'meta activa' : 'metas activas'}. Click para editar.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!hasBudget || availableCategories.length === 0}
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none"
            title={
              availableCategories.length === 0
                ? 'Todas tus categorías ya tienen meta'
                : undefined
            }
          >
            <Plus size={14} strokeWidth={2.4} />
            Nueva meta
          </button>
        </div>

        {/* KPI cards */}
        {!isEmpty && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Metas activas" value={String(goals.length)} Icon={Target} />
            <KpiCard
              label="En progreso"
              value={String(inProgress)}
              Icon={Repeat}
              iconBg="bg-[rgba(77,168,255,0.10)]"
              iconColor="text-[var(--info)]"
            />
            <KpiCard
              label="Completadas"
              value={String(completed)}
              Icon={CheckCircle2}
              iconBg="bg-[rgba(61,220,151,0.10)]"
              iconColor="text-[var(--brand-2)]"
            />
            <KpiCard
              label="Total acumulado"
              value={fmtMoneyShort(totalCurrent)}
              sub={`de ${fmtMoneyShort(totalGoalAmount)}`}
              Icon={PiggyBank}
              iconBg="bg-[rgba(245,200,66,0.10)]"
              iconColor="text-[var(--warn)]"
            />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Target size={22} strokeWidth={2} />
            </div>
            <div className="text-[16px] text-[var(--text)] font-semibold">Aún sin metas</div>
            <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Define metas para tus categorías: cuánto quieres apartar mensualmente o cuánto
              acumular en total. Te ayuda a mantener el rumbo.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!hasBudget || availableCategories.length === 0}
              className="inline-flex items-center gap-1.5 mt-2 h-10 px-5 rounded-xl gradient-bg text-[#0B0B0C] font-semibold text-[13px] glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-[filter]"
            >
              <Plus size={14} strokeWidth={2.4} />
              Crear primera meta
            </button>
          </div>
        )}

        {/* Goals list */}
        {!isEmpty && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedGoals.map((g) => {
              const Icon = iconForCategoryName(g.categoryName)
              const pct = g.goalAmount > 0 ? Math.min(1, g.current / g.goalAmount) : 0
              const isComplete = g.current >= g.goalAmount - 0.005
              const remaining = Math.max(0, g.goalAmount - g.current)
              const monthsLeft = g.goalDate ? monthsUntil(g.goalDate) : null
              const monthlyNeeded =
                monthsLeft !== null && monthsLeft > 0 && g.goalType === 'savings_balance'
                  ? remaining / monthsLeft
                  : null

              const isConfirming = confirmingDelete === g.categoryId
              return (
                <div
                  key={g.categoryId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing(g)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setEditing(g)
                    }
                  }}
                  className="group relative cursor-pointer text-left rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 hover:border-[var(--border3)] hover:bg-white/[0.02] transition-colors space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/40"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-[rgba(61,220,151,0.14)] text-[var(--brand-2)]'
                          : 'bg-white/[0.04] text-[var(--text2)]'
                      }`}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--text)] truncate">
                        {g.categoryName}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] truncate inline-flex items-center gap-1.5">
                        <span>{g.groupName}</span>
                        <span className="text-[var(--muted2)]">·</span>
                        {g.goalType === 'monthly_spending' ? (
                          <span className="inline-flex items-center gap-1">
                            <Repeat size={10} strokeWidth={2} />
                            Mensual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <PiggyBank size={10} strokeWidth={2} />
                            Acumulada
                          </span>
                        )}
                      </div>
                    </div>
                    {isComplete && (
                      <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(61,220,151,0.10)] text-[var(--brand-2)] text-[11px] font-semibold">
                        <CheckCircle2 size={11} strokeWidth={2.4} />
                        Lista
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(g.categoryId)
                      }}
                      disabled={deletingId}
                      aria-label={
                        isConfirming
                          ? `Confirmar eliminar meta de ${g.categoryName}`
                          : `Eliminar meta de ${g.categoryName}`
                      }
                      title={isConfirming ? 'Click otra vez para confirmar' : 'Eliminar meta'}
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 ${
                        isConfirming
                          ? 'bg-[rgba(255,122,89,0.18)] text-[var(--coral)] border border-[var(--coral)]/50 opacity-100'
                          : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[rgba(255,122,89,0.10)]'
                      }`}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-[18px] font-bold tabular-nums num text-[var(--text)]">
                        {fmtMoney(g.current)}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] tabular-nums">
                        de {fmtMoney(g.goalAmount)} ·{' '}
                        <span className="text-[var(--text2)] font-semibold">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full ${isComplete ? 'gradient-bg' : 'gradient-bg'} transition-[width] duration-500`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer hints */}
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
                    {g.goalDate ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={2} />
                        <span>{formatGoalDate(g.goalDate)}</span>
                        {monthsLeft !== null && monthsLeft > 0 && (
                          <span className="text-[var(--muted2)]">
                            · {monthsLeft} {monthsLeft === 1 ? 'mes' : 'meses'}
                          </span>
                        )}
                        {monthsLeft !== null && monthsLeft <= 0 && (
                          <span className="text-[var(--coral)]">· vencida</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--muted2)]">Sin fecha objetivo</span>
                    )}
                    {monthlyNeeded !== null && monthlyNeeded > 0 && !isComplete && (
                      <div className="text-[var(--text2)] tabular-nums">
                        ≈ {fmtMoneyShort(monthlyNeeded)}/mes
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <GoalFormModal
        isOpen={addOpen || editing !== null}
        onClose={handleClose}
        mode={editing ? 'edit' : 'add'}
        initial={
          editing
            ? ({
                categoryId: editing.categoryId,
                categoryName: editing.categoryName,
                groupName: editing.groupName,
                goalType: editing.goalType,
                goalAmount: editing.goalAmount,
                goalDate: editing.goalDate,
              } satisfies InitialGoal)
            : undefined
        }
        availableCategories={availableCategories}
      />
    </>
  )
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  Icon: typeof Target
  iconBg?: string
  iconColor?: string
}

function KpiCard({
  label,
  value,
  sub,
  Icon,
  iconBg = 'bg-white/[0.04]',
  iconColor = 'text-[var(--text2)]',
}: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold tabular-nums num leading-none text-[var(--text)]">
        {value}
      </div>
      {sub && <div className="text-[11px] text-[var(--muted)] mt-1 num tabular-nums">{sub}</div>}
    </div>
  )
}
