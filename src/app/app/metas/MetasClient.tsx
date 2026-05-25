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
  CalendarClock,
} from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { GoalFormModal, type InitialGoal } from './GoalFormModal'
import { clearGoal, type GoalType } from './actions'
import { useFormatMoney, useFormatMoneyShort } from '../CurrencyProvider'
import { MONTH_NAMES_SHORT } from '@/lib/dates'

const formatGoalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getFullYear()}`
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
  // True when the category lives in the "Metas" group but the user
  // hasn't picked a target amount yet — renders as a setup-prompt card
  // instead of a progress bar.
  needsSetup: boolean
}

interface Props {
  goals: ListGoal[]
  hasBudget: boolean
}

export function MetasClient({ goals, hasBudget }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ListGoal | null>(null)
  const [deletingPending, startDelete] = useTransition()

  const handleDelete = async (goal: ListGoal) => {
    const ok = await confirm({
      title: `¿Eliminar la meta de "${goal.categoryName}"?`,
      description:
        'Se borra solo la meta. La categoría y sus transacciones se mantienen intactas.',
      confirmLabel: 'Eliminar meta',
      tone: 'danger',
    })
    if (!ok) return
    startDelete(async () => {
      await clearGoal(goal.categoryId)
      router.refresh()
    })
  }

  const isEmpty = goals.length === 0

  // KPIs — only count metas with a real target. "Necesita configurar"
  // cards don't have a number yet, so they don't contribute to the totals
  // or count as completed (a $0 target shouldn't auto-mark as done).
  const configuredGoals = goals.filter((g) => !g.needsSetup)
  const totalGoalAmount = configuredGoals.reduce((s, g) => s + g.goalAmount, 0)
  const totalCurrent = configuredGoals.reduce((s, g) => s + g.current, 0)
  const completed = configuredGoals.filter(
    (g) => g.current >= g.goalAmount - 0.005,
  ).length
  const inProgress = configuredGoals.length - completed
  const needsSetupCount = goals.length - configuredGoals.length

  const sortedGoals = [...goals].sort((a, b) => {
    // Pending-setup metas sink to the bottom so the user sees configured
    // progress first.
    if (a.needsSetup !== b.needsSetup) return a.needsSetup ? 1 : -1
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Metas
            </div>
            <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
              Hacia dónde va tu <span className="gradient-text">esfuerzo</span>.
            </h1>
            <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
              {isEmpty
                ? 'Aún no has definido metas. Crea la primera para empezar a trackear progreso.'
                : needsSetupCount > 0
                  ? `${configuredGoals.length} ${configuredGoals.length === 1 ? 'meta activa' : 'metas activas'} · ${needsSetupCount} por configurar`
                  : `${goals.length} ${goals.length === 1 ? 'meta activa' : 'metas activas'}. Click para editar.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!hasBudget}
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none"
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
              iconColor="text-[var(--info-text)]"
            />
            <KpiCard
              label="Completadas"
              value={String(completed)}
              Icon={CheckCircle2}
              iconBg="bg-[rgba(61,220,151,0.10)]"
              iconColor="text-[var(--brand-text)]"
            />
            <KpiCard
              label="Total acumulado"
              value={fmtMoneyShort(totalCurrent)}
              sub={`de ${fmtMoneyShort(totalGoalAmount)}`}
              Icon={PiggyBank}
              iconBg="bg-[rgba(245,200,66,0.10)]"
              iconColor="text-[var(--warn-text)]"
            />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--overlay-1)] flex items-center justify-center mx-auto text-[var(--text2)]">
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
              disabled={!hasBudget}
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
              // Pending-setup cards render a minimal "Configurar meta"
              // CTA — no progress bar (there's nothing to track yet).
              if (g.needsSetup) {
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
                    className="group relative cursor-pointer text-left rounded-2xl border-2 border-dashed border-[var(--border3)] bg-[var(--s1)] p-5 hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] transition-colors space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--overlay-1)] flex items-center justify-center shrink-0 text-[var(--text2)]">
                        <Icon size={18} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-[var(--text)] truncate">
                          {g.categoryName}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] truncate inline-flex items-center gap-1.5">
                          <span>{g.groupName}</span>
                          <span className="text-[var(--muted2)]">·</span>
                          <span className="text-[var(--warn-text)] font-medium">
                            Sin meta configurada
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand-text)]">
                      <Target size={12} strokeWidth={2.4} />
                      Configurar meta
                    </div>
                  </div>
                )
              }

              const pct = g.goalAmount > 0 ? Math.min(1, g.current / g.goalAmount) : 0
              const isComplete = g.goalAmount > 0 && g.current >= g.goalAmount - 0.005
              const remaining = Math.max(0, g.goalAmount - g.current)
              const monthsLeft = g.goalDate ? monthsUntil(g.goalDate) : null
              const monthlyNeeded =
                monthsLeft !== null &&
                monthsLeft > 0 &&
                (g.goalType === 'savings_balance' || g.goalType === 'needed_by')
                  ? remaining / monthsLeft
                  : null

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
                  className="group relative cursor-pointer text-left rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 hover:border-[var(--border3)] hover:bg-[var(--overlay-1)] transition-colors space-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]/40"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-[rgba(61,220,151,0.14)] text-[var(--brand-text)]'
                          : 'bg-[var(--overlay-1)] text-[var(--text2)]'
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
                        ) : g.goalType === 'needed_by' ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock size={10} strokeWidth={2} />
                            Por fecha
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
                      <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] text-[11px] font-semibold">
                        <CheckCircle2 size={11} strokeWidth={2.4} />
                        Lista
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(g)
                      }}
                      disabled={deletingPending}
                      aria-label={`Eliminar meta de ${g.categoryName}`}
                      title="Eliminar meta"
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)]"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Remaining hero */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2 gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                          {isComplete ? 'Meta cumplida' : 'Te falta'}
                        </div>
                        <div
                          className={`text-[20px] font-bold tabular-nums num leading-none mt-0.5 ${
                            isComplete ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {fmtMoney(remaining)}
                        </div>
                      </div>
                      <div className="text-[11px] text-[var(--muted)] tabular-nums num text-right">
                        {fmtMoney(g.current)}
                        <br />
                        <span className="text-[var(--muted2)]">de {fmtMoney(g.goalAmount)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--overlay-1)] overflow-hidden">
                      <div
                        className="h-full gradient-bg transition-[width] duration-500"
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
                          <span className="text-[var(--coral-text)]">· vencida</span>
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
  iconBg = 'bg-[var(--overlay-1)]',
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
