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
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { Stat } from '@/components/ui/Stat'
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
          <div className="min-w-0">
            <PageHeader
              eyebrow="Metas"
              description={
                isEmpty
                  ? 'Aún no has definido metas. Crea la primera para empezar a trackear progreso.'
                  : needsSetupCount > 0
                    ? `${configuredGoals.length} ${configuredGoals.length === 1 ? 'meta activa' : 'metas activas'} · ${needsSetupCount} por configurar`
                    : `${goals.length} ${goals.length === 1 ? 'meta activa' : 'metas activas'}. Click para editar.`
              }
            >
              Hacia dónde va tu <span className="gradient-text">esfuerzo</span>.
            </PageHeader>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!hasBudget}
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body-sm rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus size={14} strokeWidth={2.4} />
            Nueva meta
          </button>
        </div>

        {/* KPI cards */}
        {!isEmpty && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Metas activas" value={String(goals.length)} Icon={Target} />
            <Stat
              label="En progreso"
              value={String(inProgress)}
              Icon={Repeat}
              iconBg="bg-[rgba(77,168,255,0.10)]"
              iconColor="text-[var(--info-text)]"
            />
            <Stat
              label="Completadas"
              value={String(completed)}
              Icon={CheckCircle2}
              iconBg="bg-[rgba(61,220,151,0.10)]"
              iconColor="text-[var(--brand-text)]"
            />
            <Stat
              label="Total acumulado"
              value={fmtMoneyShort(totalCurrent)}
              sub={`de ${fmtMoneyShort(totalGoalAmount)}`}
              Icon={PiggyBank}
              iconBg="bg-[rgba(245,200,66,0.10)]"
              iconColor="text-[var(--warn-text)]"
            />
          </div>
        )}

        {isEmpty && (
          <EmptyState
            Icon={Target}
            title="Aún sin metas"
            description="Define metas para tus categorías: cuánto quieres apartar mensualmente o cuánto acumular en total. Te ayuda a mantener el rumbo."
            action={
              <Button
                size="tight"
                onClick={() => setAddOpen(true)}
                disabled={!hasBudget}
                iconLeft={<Plus size={14} strokeWidth={2.4} />}
              >
                Crear primera meta
              </Button>
            }
          />
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
                        <div className="text-emph font-semibold text-[var(--text)] truncate">
                          {g.categoryName}
                        </div>
                        <div className="text-eyebrow text-[var(--muted)] truncate inline-flex items-center gap-1.5">
                          <span>{g.groupName}</span>
                          <span className="text-[var(--muted2)]">·</span>
                          <span className="text-[var(--warn-text)] font-medium">
                            Sin meta configurada
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-meta font-semibold text-[var(--brand-text)]">
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
                      <div className="text-emph font-semibold text-[var(--text)] truncate">
                        {g.categoryName}
                      </div>
                      <div className="text-eyebrow text-[var(--muted)] truncate inline-flex items-center gap-1.5">
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
                      <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] text-eyebrow font-semibold">
                        <CheckCircle2 size={11} strokeWidth={2.4} />
                        Lista
                      </div>
                    )}
                    <IconButton
                      size="sm"
                      tone="danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(g)
                      }}
                      disabled={deletingPending}
                      aria-label={`Eliminar meta de ${g.categoryName}`}
                      title="Eliminar meta"
                      className="shrink-0"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </IconButton>
                  </div>

                  {/* Remaining hero */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2 gap-3">
                      <div>
                        <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                          {isComplete ? 'Meta cumplida' : 'Te falta'}
                        </div>
                        <div
                          className={`text-h2 font-bold tabular-nums num leading-none mt-0.5 ${
                            isComplete ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {fmtMoney(remaining)}
                        </div>
                      </div>
                      <div className="text-eyebrow text-[var(--muted)] tabular-nums num text-right">
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
                  <div className="flex items-center justify-between gap-3 text-eyebrow text-[var(--muted)]">
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

