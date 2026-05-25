'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ArrowRight, CheckCircle2 } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'
import { useFormatMoney } from './CurrencyProvider'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { InlineMoneyEdit } from './plan/InlineMoneyEdit'
import { updateAssignment } from './plan/actions'
import { CategoryDrillModal } from './plan/CategoryDrillModal'
import { PayFromAccountMenu } from './PayFromAccountMenu'
import { createTransaction } from './transacciones/actions'
import type { SectionGroup } from './CategoryCardsSection'

interface AccountOption {
  id: string
  name: string
}

interface CategoryAccordionProps {
  groups: SectionGroup[]
  /** Required for inline editing — passed to updateAssignment when
   *  the user commits a new amount on a category row. */
  budgetId: string
  month: string
  /** Active accounts — feeds the "Pagar desde…" dropdown per row.
   *  When the user picks one, a transaction is created on the spot
   *  using the category's budgeted (assigned) amount. */
  accounts: AccountOption[]
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Right-rail accordion that lists category groups; opens the first
 * group by default. Mirrors the Plan view: each row exposes the
 * Asignado / Actividad / Disponible columns and the Asignado cell is
 * editable in-place via InlineMoneyEdit. Click on the category name
 * area opens the same 12-month drill modal that /app/plan uses.
 */
export function CategoryAccordion({
  groups,
  budgetId,
  month,
  accounts,
}: CategoryAccordionProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const rtaCtx = useReadyToAssign()

  const initialOpen =
    groups.find((g) => g.categories.length > 0)?.id ?? groups[0]?.id ?? null
  const [openId, setOpenId] = useState<string | null>(initialOpen)
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null)
  const [, startPay] = useTransition()
  const [payToast, setPayToast] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  // Auto-dismiss toasts after 4s.
  useEffect(() => {
    if (!payToast) return
    const t = setTimeout(() => setPayToast(null), 4000)
    return () => clearTimeout(t)
  }, [payToast])
  useEffect(() => {
    if (!payError) return
    const t = setTimeout(() => setPayError(null), 6000)
    return () => clearTimeout(t)
  }, [payError])

  /**
   * Auto-pay: creates a transaction immediately using the category's
   * budgeted (assigned) amount, today's date, and the chosen account.
   * No modal — the user already made 3 choices (category + Pagar +
   * account), opening a form would be redundant. RtA / row available
   * update via router.refresh() once the server returns.
   */
  const handleQuickPay = (
    catId: string,
    catName: string,
    assignedAmount: number,
    accountId: string,
    accountName: string,
  ) => {
    if (assignedAmount <= 0.005) {
      setPayError(
        `${catName} no tiene presupuesto este mes — asigna un monto antes de pagar.`,
      )
      return
    }
    setPayError(null)
    startPay(async () => {
      const r = await createTransaction({
        accountId,
        categoryId: catId,
        date: todayISO(),
        payeeName: catName,
        amount: assignedAmount,
        memo: null,
        type: 'expense',
      })
      if (r && 'error' in r && r.error) {
        setPayError(r.error)
        return
      }
      setPayToast(
        `Pagado ${fmtMoney(assignedAmount)} de ${catName} desde ${accountName}.`,
      )
      router.refresh()
    })
  }

  // Local optimistic state for inline edits — same pattern Plan uses.
  // Override map by categoryId for the assigned amount; we add the
  // delta to the row's lifetime available so both numbers stay
  // consistent until the next router.refresh().
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  const getAssigned = (catId: string, fallback: number) =>
    overrides[catId] !== undefined ? overrides[catId] : fallback

  const handleSave = async (
    catId: string,
    previousAssigned: number,
    next: number,
  ) => {
    const delta = next - previousAssigned
    setOverrides((p) => ({ ...p, [catId]: next }))
    setError(null)
    rtaCtx?.adjust(delta)
    const result = await updateAssignment(budgetId, catId, month, next)
    if ('error' in result && result.error) {
      // Rollback
      setOverrides((p) => ({ ...p, [catId]: previousAssigned }))
      rtaCtx?.adjust(-delta)
      setError(result.error)
      window.setTimeout(() => setError(null), 5000)
    }
  }

  if (groups.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 text-center">
        <p className="text-body-sm text-[var(--muted)]">
          No tienes categorías todavía.
        </p>
      </section>
    )
  }

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader>
        <h2 className="text-body font-semibold text-[var(--text)]">Categorías</h2>
        <Link
          href="/app/plan"
          className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0"
        >
          Ver plan
          <ArrowRight size={12} strokeWidth={2.4} />
        </Link>
      </CardHeader>

      {error && (
        <div className="px-5 py-2 bg-[rgba(255,122,89,0.08)] border-b border-[var(--coral)]/30 text-meta text-[var(--coral-text)]">
          No pudimos guardar: {error}
        </div>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {groups.map((g) => {
          const isOpen = openId === g.id
          // Group totals reflect any local overrides on its categories
          // so the header math stays in sync while the user edits.
          const groupAssigned = g.categories.reduce(
            (s, c) => s + getAssigned(c.id, c.assigned),
            0,
          )
          const groupAvailable = g.categories.reduce((s, c) => {
            const delta = getAssigned(c.id, c.assigned) - c.assigned
            return s + (c.available + delta)
          }, 0)
          const overspent = groupAvailable < -0.005
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : g.id)}
                aria-expanded={isOpen}
                aria-controls={`acc-${g.id}`}
                className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors hover:bg-[var(--overlay-1)] ${
                  isOpen ? 'bg-[var(--overlay-1)]' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm font-semibold text-[var(--text)] truncate">
                    {g.name}
                  </div>
                  <div className="text-eyebrow text-[var(--muted)] tabular-nums num">
                    {g.categories.length}{' '}
                    {g.categories.length === 1 ? 'categoría' : 'categorías'}
                    {' · '}
                    Presupuesto {fmtMoney(groupAssigned)}
                  </div>
                </div>
                <span
                  className={`text-meta font-semibold tabular-nums num shrink-0 ${
                    overspent
                      ? 'text-[var(--coral-text)]'
                      : 'text-[var(--brand-text)]'
                  }`}
                >
                  {fmtMoney(groupAvailable)}
                </span>
                <ChevronDown
                  size={14}
                  strokeWidth={2.4}
                  className={`shrink-0 text-[var(--muted)] transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div
                  id={`acc-${g.id}`}
                  className="bg-[var(--bg)]/40 border-t border-[var(--border)]"
                >
                  {g.categories.length === 0 ? (
                    <p className="px-5 py-4 text-meta text-[var(--muted)]">
                      Este grupo aún no tiene categorías.
                    </p>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto">
                      {/* Headers — match Plan layout.
                          Sticky al tope del scroll container del grupo:
                          cuando el usuario scrollea dentro de la lista
                          (más de 320px de contenido), los labels de
                          columna se quedan visibles. El bg sólido evita
                          que las filas se vean por debajo al pegarse. */}
                      <div className="sticky top-0 z-10 grid grid-cols-[1fr_90px_70px_90px] gap-2 px-5 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--muted2)] border-b border-[var(--border)] bg-[var(--s1)] backdrop-blur-sm">
                        <div>Categoría</div>
                        <div
                          className="text-right"
                          title="Monto presupuestado este mes"
                        >
                          Presupuesto
                        </div>
                        <div className="text-right">Actividad</div>
                        <div className="text-right">Disponible</div>
                      </div>
                      <ul>
                        {g.categories.map((c) => {
                          const Icon = iconForCategoryName(c.name)
                          const assigned = getAssigned(c.id, c.assigned)
                          // Local available reflects the override delta
                          // so the row updates instantly on edit.
                          const delta = assigned - c.assigned
                          const available = c.available + delta
                          const catOver = available < -0.005
                          const activity = c.activity ?? 0
                          const hasActivity = Math.abs(activity) > 0.005
                          return (
                            <li
                              key={c.id}
                              className="grid grid-cols-[1fr_90px_70px_90px] gap-2 items-center px-5 py-2 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--overlay-1)] transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setDrillCategoryId(c.id)}
                                  aria-label={`Ver historial de ${c.name}`}
                                  className="flex items-center gap-2.5 min-w-0 text-left group flex-1"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0 group-hover:text-[var(--brand-text)] transition-colors">
                                    <Icon size={12} strokeWidth={2} />
                                  </div>
                                  <span className="text-body-sm text-[var(--text)] truncate group-hover:text-[var(--brand-text)] transition-colors">
                                    {c.name}
                                  </span>
                                </button>
                                <PayFromAccountMenu
                                  accounts={accounts}
                                  onSelect={(accountId) => {
                                    const acc = accounts.find(
                                      (a) => a.id === accountId,
                                    )
                                    handleQuickPay(
                                      c.id,
                                      c.name,
                                      assigned,
                                      accountId,
                                      acc?.name ?? '',
                                    )
                                  }}
                                />
                              </div>
                              <div className="text-right">
                                <InlineMoneyEdit
                                  value={assigned}
                                  onSave={(next) =>
                                    handleSave(c.id, assigned, next)
                                  }
                                  ariaLabel={`Asignar a ${c.name}`}
                                />
                              </div>
                              <span
                                className={`text-meta tabular-nums num text-right ${
                                  hasActivity
                                    ? 'text-[var(--text2)]'
                                    : 'text-[var(--muted)]'
                                }`}
                              >
                                {hasActivity ? fmtMoney(activity) : '—'}
                              </span>
                              <span
                                className={`text-meta font-semibold tabular-nums num text-right ${
                                  catOver
                                    ? 'text-[var(--coral-text)]'
                                    : 'text-[var(--text)]'
                                }`}
                              >
                                {fmtMoney(available)}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Drill modal — same component used in /app/plan: 12-month
          history, totals (asignado / gastado / disponible / promedio)
          y lista de transacciones. */}
      {drillCategoryId && (
        <CategoryDrillModal
          isOpen={drillCategoryId !== null}
          onClose={() => setDrillCategoryId(null)}
          categoryId={drillCategoryId}
        />
      )}

      {/* Auto-pay confirmation / error toasts. Centered top so they
          don't compete with the bottom transaction toast in
          /app/transacciones. Auto-dismiss in 4–6s. */}
      {payToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0 z-50 px-5 py-3 rounded-2xl border border-[var(--brand-2)]/40 bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.4)] inline-flex items-center gap-2.5 max-w-[92vw] animate-step pointer-events-none"
        >
          <CheckCircle2
            size={18}
            strokeWidth={2.4}
            className="text-[var(--brand-text)] shrink-0"
          />
          <span className="text-body font-medium text-[var(--text)]">
            {payToast}
          </span>
        </div>
      )}
      {payError && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0 z-50 px-5 py-3 rounded-2xl border border-[var(--coral)]/40 bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.4)] inline-flex items-center gap-2.5 max-w-[92vw] animate-step"
        >
          <span className="text-body text-[var(--coral-text)] font-medium">
            {payError}
          </span>
        </div>
      )}
    </Card>
  )
}
