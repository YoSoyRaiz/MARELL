'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { InlineMoneyEdit } from './InlineMoneyEdit'
import { AnimatedNumber } from './AnimatedNumber'
import { MoveMoneyModal } from './MoveMoneyModal'
import { CategoryDrillModal } from './CategoryDrillModal'
import { updateAssignment } from './actions'
import { useReadyToAssign } from '../ReadyToAssignProvider'
import { useFormatMoney } from '../CurrencyProvider'
import { PayFromAccountMenu } from '../PayFromAccountMenu'
import { TransactionFormModal } from '../transacciones/TransactionFormModal'

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]


const formatMonthLabel = (month: string) => {
  const [year, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${year}`
}

const adjustMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface PlanCategory {
  id: string
  name: string
  goal_amount: number | null
  /** This month's assignment (the InlineMoneyEdit value). */
  assigned: number
  /** This month's activity (signed; negative for expenses). */
  activity: number
  /**
   * Lifetime available: Σ(assignments all months) + Σ(activity all time).
   * This is the YNAB "Available" — carry-over from prior months is folded
   * in here. We adjust it client-side when the user overrides `assigned`.
   */
  available: number
}

export interface PlanGroup {
  id: string
  name: string
  categories: PlanCategory[]
}

interface PlanAccount {
  id: string
  name: string
}

interface PlanCategoryOption {
  id: string
  name: string
  group_name: string
}

interface PlanViewProps {
  budgetId: string | null
  month: string
  /** Kept for backward-compat — no longer used since ReadyToAssign is sourced from the global provider. */
  totalCash: number
  groups: PlanGroup[]
  /** Active accounts feed the per-category "Pagar desde…" dropdown
   *  and the TransactionFormModal it opens. Optional so existing
   *  callers (admin, fixtures) keep working. */
  accounts?: PlanAccount[]
  /** Categories list used by TransactionFormModal — separate from
   *  PlanGroup so we don't duplicate the structure. */
  categoryOptions?: PlanCategoryOption[]
}

type Filter = 'todas' | 'subfondeadas' | 'con-dinero'

export function PlanView({
  budgetId,
  month,
  totalCash,
  groups,
  accounts = [],
  categoryOptions = [],
}: PlanViewProps) {
  const router = useRouter()
  const rtaCtx = useReadyToAssign()
  const fmtMoney = useFormatMoney()
  const [navPending, startNav] = useTransition()
  const [filter, setFilter] = useState<Filter>('todas')
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  // Local override of `available` after a money-move so both rows reflect
  // the new state until the next router.refresh() repopulates `groups`.
  const [availableOverrides, setAvailableOverrides] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null)
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null)
  // Quick-pay flow: pick an account from a category's "Pagar desde…"
  // dropdown → opens TransactionFormModal pre-filled with category +
  // account so the user only has to type the amount and (optionally)
  // the payee.
  const [quickPay, setQuickPay] = useState<{
    categoryId: string
    accountId: string
  } | null>(null)
  // Default-open the first group, collapse the rest. Lets the user
  // see actionable rows immediately without expandir manualmente.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groups.slice(1).map((g) => g.id)),
  )

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const goToMonth = (next: string) => {
    setOverrides({}) // navigation refetches; clear local overrides
    setAvailableOverrides({})
    startNav(() => {
      router.push(`/app/plan?month=${next}`)
    })
  }

  const getAssigned = useCallback(
    (cat: PlanCategory) => (overrides[cat.id] !== undefined ? overrides[cat.id] : cat.assigned),
    [overrides],
  )

  const handleSave = async (cat: PlanCategory, next: number) => {
    if (!budgetId) return
    const previous = getAssigned(cat)
    const delta = next - previous
    setOverrides((p) => ({ ...p, [cat.id]: next }))
    setError(null)
    rtaCtx?.adjust(delta) // optimistic topbar update
    const result = await updateAssignment(budgetId, cat.id, month, next)
    if ('error' in result && result.error) {
      // Rollback
      setOverrides((p) => ({ ...p, [cat.id]: previous }))
      rtaCtx?.adjust(-delta)
      setError(result.error)
      window.setTimeout(() => setError(null), 5000)
    }
  }

  // Hero "Por asignar" mirrors the topbar pill so the user sees a
  // consistent number across the app. The pill is driven by
  // ReadyToAssignProvider which gets the YNAB-style lifetime calculation
  // from the layout. InlineMoneyEdit pushes delta updates into it
  // optimistically so the hero animates as the user assigns.
  const readyToAssign = rtaCtx?.readyToAssign ?? 0

  // Available shown in the row reflects lifetime carry-over + any local
  // override on this month's assignment. delta is positive when the user
  // bumped the assignment up via InlineMoneyEdit. Money-moves write into
  // `availableOverrides` so both source and destination rows update without
  // round-tripping the whole grid.
  const computeAvailable = (c: PlanCategory) => {
    if (availableOverrides[c.id] !== undefined) return availableOverrides[c.id]
    const delta = getAssigned(c) - c.assigned
    return c.available + delta
  }

  const handleMoved = (
    fromId: string,
    toId: string,
    fromAssigned: number,
    toAssigned: number,
  ) => {
    // Available shifts by exactly the assigned delta on each side
    // (lifetime available = Σ assignments + Σ activity, and only
    // assignments changed here).
    const fromCat = groups.flatMap((g) => g.categories).find((x) => x.id === fromId)
    const toCat = groups.flatMap((g) => g.categories).find((x) => x.id === toId)
    if (fromCat && toCat) {
      const fromAvailBefore = computeAvailable(fromCat)
      const toAvailBefore = computeAvailable(toCat)
      const fromDelta = fromAssigned - getAssigned(fromCat)
      const toDelta = toAssigned - getAssigned(toCat)
      setAvailableOverrides((p) => ({
        ...p,
        [fromId]: fromAvailBefore + fromDelta,
        [toId]: toAvailBefore + toDelta,
      }))
    }
    setOverrides((p) => ({ ...p, [fromId]: fromAssigned, [toId]: toAssigned }))
    router.refresh()
  }

  const filteredGroups = useMemo(() => {
    if (filter === 'todas') return groups
    return groups
      .map((g) => ({
        ...g,
        categories: g.categories.filter((c) => {
          const assigned = getAssigned(c)
          const delta = assigned - c.assigned
          const available = c.available + delta
          if (filter === 'subfondeadas') {
            if (c.goal_amount && c.goal_amount > 0) return assigned < c.goal_amount
            return available < 0
          }
          if (filter === 'con-dinero') return available > 0.005
          return true
        }),
      }))
      .filter((g) => g.categories.length > 0)
  }, [groups, filter, getAssigned])

  const isPositive = readyToAssign > 0.005
  const isNegative = readyToAssign < -0.005
  // Use *-text shades and bumped tint opacity so the hero stays
  // legible on light mode (paper white). Same vibe in dark.
  const heroBorder = isNegative
    ? 'border-[var(--coral)]/50 bg-[rgba(255,122,89,0.10)]'
    : 'border-[var(--brand-2)]/45 bg-[rgba(61,220,151,0.08)]'
  const heroLabelColor = isNegative
    ? 'text-[var(--coral-text)]'
    : 'text-[var(--brand-text)]'
  const heroAmountColor = isNegative
    ? 'text-[var(--coral-text)]'
    : 'gradient-text'

  if (!budgetId) {
    return (
      <div className="space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Plan
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Sin presupuesto <span className="gradient-text">aún</span>.
        </h1>
        <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
          Termina el onboarding para ver tu Plan aquí.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${navPending ? 'opacity-60' : ''}`}>
      {/* Header: month nav + title */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Plan
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goToMonth(adjustMonth(month, -1))}
              aria-label="Mes anterior"
              className="w-10 h-10 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
            <h1 className="text-[20px] sm:text-[28px] lg:text-[32px] leading-none font-bold tracking-tight tabular-nums">
              {formatMonthLabel(month)}
            </h1>
            <button
              type="button"
              onClick={() => goToMonth(adjustMonth(month, 1))}
              aria-label="Mes siguiente"
              className="w-10 h-10 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
            >
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
          <AlertCircle
            size={18}
            strokeWidth={2}
            className="text-[var(--coral-text)] shrink-0 mt-0.5"
          />
          <div className="text-[14px] text-[var(--text)] leading-relaxed flex-1">
            <div className="font-medium">No pudimos guardar el cambio.</div>
            <div className="text-[var(--text2)] mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Ready to Assign hero */}
      <div className={`rounded-2xl border-2 px-6 py-5 transition-colors ${heroBorder}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div
              className={`text-[12px] uppercase tracking-[0.18em] font-semibold ${heroLabelColor}`}
            >
              Por asignar
            </div>
            <div className="text-[13px] text-[var(--text2)] mt-1">
              {isNegative
                ? 'Asignaste de más. Reduce alguna categoría.'
                : isPositive
                  ? 'Click en cualquier categoría para asignar dinero.'
                  : 'Cada peso tiene su trabajo. ¡Plan en marcha!'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AnimatedNumber
              value={readyToAssign}
              format={fmtMoney}
              className={`text-[34px] sm:text-[42px] font-bold tabular-nums num shrink-0 ${heroAmountColor}`}
            />
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { id: 'todas', label: 'Todas' },
            { id: 'subfondeadas', label: 'Subfondeadas' },
            { id: 'con-dinero', label: 'Con dinero' },
          ] as { id: Filter; label: string }[]
        ).map((c) => {
          const active = filter === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`h-8 px-4 text-[12px] font-medium rounded-full transition-colors ${
                active
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'bg-[var(--overlay-1)] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-3)]'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredGroups.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-10 text-center">
          <div className="text-[var(--text2)] text-[14px]">
            Sin categorías que coincidan con este filtro.
          </div>
        </div>
      )}

      {/* Category groups */}
      <div className="space-y-4">
        {filteredGroups.map((g) => {
          const groupAssigned = g.categories.reduce((s, c) => s + getAssigned(c), 0)
          const groupAvailable = g.categories.reduce(
            (s, c) => s + computeAvailable(c),
            0,
          )
          const isCollapsed = collapsed.has(g.id)
          const panelId = `plan-group-${g.id}`
          return (
            <div
              key={g.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden"
            >
              {/* Group header — accordion toggle */}
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                className={`w-full px-5 py-3 ${
                  isCollapsed ? '' : 'border-b border-[var(--border)]'
                } bg-[var(--overlay-1)] hover:bg-[var(--overlay-2)] flex items-center justify-between gap-4 transition-colors text-left`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown
                    size={16}
                    strokeWidth={2.4}
                    className={`text-[var(--text2)] shrink-0 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] truncate">
                    {g.name}
                  </h3>
                  <span className="text-[11px] text-[var(--muted)] tabular-nums shrink-0">
                    {g.categories.length}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-3 md:gap-6 text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] tabular-nums num shrink-0">
                  <span>
                    Presup{' '}
                    <span className="text-[var(--text2)] normal-case tracking-normal text-[12px] ml-1">
                      {fmtMoney(groupAssigned)}
                    </span>
                  </span>
                  <span>
                    Disp{' '}
                    <span
                      className={`normal-case tracking-normal text-[12px] ml-1 font-semibold ${
                        groupAvailable < -0.005 ? 'text-[var(--coral-text)]' : 'text-[var(--text2)]'
                      }`}
                    >
                      {fmtMoney(groupAvailable)}
                    </span>
                  </span>
                </div>
                {/* Mobile: just available, the most actionable number */}
                <div
                  className={`sm:hidden tabular-nums num text-[12px] font-semibold shrink-0 ${
                    groupAvailable < -0.005 ? 'text-[var(--coral-text)]' : 'text-[var(--text2)]'
                  }`}
                >
                  {fmtMoney(groupAvailable)}
                </div>
              </button>

              {!isCollapsed && (
                <div id={panelId}>
              {/* Column headers */}
              <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px] gap-2 px-5 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
                <div>Categoría</div>
                <div className="text-right" title="Monto presupuestado este mes">
                  Presupuesto
                </div>
                <div className="text-right">Actividad</div>
                <div className="text-right">Disponible</div>
              </div>

              {/* Rows */}
              <ul>
                {g.categories.map((c) => {
                  const Icon = iconForCategoryName(c.name)
                  const assigned = getAssigned(c)
                  const available = computeAvailable(c)
                  const availableColor =
                    available > 0.005
                      ? 'gradient-text'
                      : available < -0.005
                        ? 'text-[var(--coral-text)]'
                        : 'text-[var(--muted)]'
                  return (
                    <li
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--overlay-1)] transition-colors"
                    >
                      {/* Mobile layout: stacked rows */}
                      <div className="md:hidden px-4 py-3 space-y-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => setDrillCategoryId(c.id)}
                            aria-label={`Ver historial de ${c.name}`}
                            className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0 hover:text-[var(--brand-text)] transition-colors"
                          >
                            <Icon size={16} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrillCategoryId(c.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="text-[14px] text-[var(--text)] truncate hover:text-[var(--brand-text)] transition-colors">
                              {c.name}
                            </div>
                            {c.goal_amount && c.goal_amount > 0 && (
                              <div className="text-[11px] text-[var(--muted)] num">
                                meta: ${c.goal_amount.toLocaleString('en-US')}
                              </div>
                            )}
                          </button>
                          <div className="shrink-0">
                            <InlineMoneyEdit
                              value={assigned}
                              onSave={(next) => handleSave(c, next)}
                              ariaLabel={`Asignar a ${c.name}`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pl-12 text-[11px]">
                          <span className="text-[var(--muted)] tabular-nums num">
                            Actividad:{' '}
                            <span className="text-[var(--text2)]">
                              {c.activity === 0 ? '—' : fmtMoney(c.activity)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setMoveSourceId(c.id)}
                            className={`tabular-nums num font-semibold underline-offset-4 hover:underline ${availableColor}`}
                            aria-label={`Mover dinero desde ${c.name}`}
                          >
                            {fmtMoney(available)}
                          </button>
                        </div>
                      </div>

                      {/* Desktop layout: 4-col grid */}
                      <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px] gap-2 px-5 py-3.5 items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => setDrillCategoryId(c.id)}
                            className="flex items-center gap-3 min-w-0 text-left group flex-1"
                          >
                            <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0 group-hover:text-[var(--brand-text)] transition-colors">
                              <Icon size={16} strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[14px] text-[var(--text)] truncate group-hover:text-[var(--brand-text)] transition-colors">
                                {c.name}
                              </div>
                              {c.goal_amount && c.goal_amount > 0 && (
                                <div className="text-[11px] text-[var(--muted)] num">
                                  meta: ${c.goal_amount.toLocaleString('en-US')}
                                </div>
                              )}
                            </div>
                          </button>
                          <PayFromAccountMenu
                            accounts={accounts}
                            onSelect={(accountId) =>
                              setQuickPay({ categoryId: c.id, accountId })
                            }
                          />
                        </div>
                        <div className="text-right">
                          <InlineMoneyEdit
                            value={assigned}
                            onSave={(next) => handleSave(c, next)}
                            ariaLabel={`Asignar a ${c.name}`}
                          />
                        </div>
                        <div className="text-right text-[14px] tabular-nums num text-[var(--muted)]">
                          {c.activity === 0 ? '—' : fmtMoney(c.activity)}
                        </div>
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setMoveSourceId(c.id)}
                            className={`text-[14px] tabular-nums num font-semibold underline-offset-4 hover:underline ${availableColor}`}
                            aria-label={`Mover dinero desde ${c.name}`}
                          >
                            {fmtMoney(available)}
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {drillCategoryId && (
        <CategoryDrillModal
          isOpen={true}
          onClose={() => setDrillCategoryId(null)}
          categoryId={drillCategoryId}
        />
      )}

      {moveSourceId && budgetId && (() => {
        const sourceCat = groups
          .flatMap((g) => g.categories)
          .find((c) => c.id === moveSourceId)
        if (!sourceCat) return null
        return (
          <MoveMoneyModal
            isOpen={true}
            onClose={() => setMoveSourceId(null)}
            budgetId={budgetId}
            month={month}
            fromCategoryId={moveSourceId}
            groups={groups}
            fromAvailable={computeAvailable(sourceCat)}
            onMoved={handleMoved}
          />
        )
      })()}

      {/* Quick-pay modal — pre-fills category + account so the user
          only needs to enter amount and (optionally) payee. */}
      {quickPay && (
        <TransactionFormModal
          isOpen={true}
          onClose={() => setQuickPay(null)}
          accounts={accounts}
          categories={categoryOptions}
          mode="add"
          defaultCategoryId={quickPay.categoryId}
          defaultAccountId={quickPay.accountId}
          onSaved={() => {
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
