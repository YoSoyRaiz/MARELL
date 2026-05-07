'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { useFormatMoney } from './CurrencyProvider'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { InlineMoneyEdit } from './plan/InlineMoneyEdit'
import { updateAssignment } from './plan/actions'
import { CategoryDrillModal } from './plan/CategoryDrillModal'
import { PayFromAccountMenu } from './PayFromAccountMenu'
import {
  TransactionFormModal,
  type InitialTransaction,
} from './transacciones/TransactionFormModal'
import type { SectionGroup } from './CategoryCardsSection'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface CategoryAccordionProps {
  groups: SectionGroup[]
  /** Required for inline editing — passed to updateAssignment when
   *  the user commits a new amount on a category row. */
  budgetId: string
  month: string
  /** Active accounts — feeds the "Pagar desde…" dropdown per row and
   *  the TransactionFormModal it opens. */
  accounts: AccountOption[]
  /** Categories list shape required by TransactionFormModal. */
  categories: CategoryOption[]
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
  categories,
}: CategoryAccordionProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const rtaCtx = useReadyToAssign()

  const initialOpen =
    groups.find((g) => g.categories.length > 0)?.id ?? groups[0]?.id ?? null
  const [openId, setOpenId] = useState<string | null>(initialOpen)
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null)
  // Quick-pay flow: when the user picks an account from the
  // "Pagar desde…" dropdown of a category, we open the existing
  // TransactionFormModal pre-filled with that category + account so
  // the user only has to type the amount and (optionally) the payee.
  const [quickPay, setQuickPay] = useState<{
    categoryId: string
    accountId: string
  } | null>(null)

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
        <p className="text-[13px] text-[var(--muted)]">
          No tienes categorías todavía.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">Categorías</h2>
        <Link
          href="/app/plan"
          className="text-[12px] text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0"
        >
          Ver plan
          <ArrowRight size={12} strokeWidth={2.4} />
        </Link>
      </header>

      {error && (
        <div className="px-5 py-2 bg-[rgba(255,122,89,0.08)] border-b border-[var(--coral)]/30 text-[12px] text-[var(--coral-text)]">
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
                  <div className="text-[13px] font-semibold text-[var(--text)] truncate">
                    {g.name}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] tabular-nums num">
                    {g.categories.length}{' '}
                    {g.categories.length === 1 ? 'categoría' : 'categorías'}
                    {' · '}
                    Asignado {fmtMoney(groupAssigned)}
                  </div>
                </div>
                <span
                  className={`text-[12px] font-semibold tabular-nums num shrink-0 ${
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
                    <p className="px-5 py-4 text-[12px] text-[var(--muted)]">
                      Este grupo aún no tiene categorías.
                    </p>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto">
                      {/* Headers — match Plan layout. */}
                      <div className="grid grid-cols-[1fr_90px_70px_90px] gap-2 px-5 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--muted2)] border-b border-[var(--border)]">
                        <div>Categoría</div>
                        <div className="text-right">Asignado</div>
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
                                  <span className="text-[13px] text-[var(--text)] truncate group-hover:text-[var(--brand-text)] transition-colors">
                                    {c.name}
                                  </span>
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
                                  onSave={(next) =>
                                    handleSave(c.id, assigned, next)
                                  }
                                  ariaLabel={`Asignar a ${c.name}`}
                                />
                              </div>
                              <span
                                className={`text-[12px] tabular-nums num text-right ${
                                  hasActivity
                                    ? 'text-[var(--text2)]'
                                    : 'text-[var(--muted)]'
                                }`}
                              >
                                {hasActivity ? fmtMoney(activity) : '—'}
                              </span>
                              <span
                                className={`text-[12px] font-semibold tabular-nums num text-right ${
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

      {/* Quick-pay modal — opens with category + account pre-filled
          when the user selects an account from a category's
          "Pagar desde…" dropdown. The user types the amount and
          optionally the payee, then submits. router.refresh() at
          close keeps the accordion in sync with the new transaction. */}
      {quickPay && (
        <TransactionFormModal
          isOpen={true}
          onClose={() => setQuickPay(null)}
          accounts={accounts}
          categories={categories}
          mode="add"
          defaultCategoryId={quickPay.categoryId}
          defaultAccountId={quickPay.accountId}
          onSaved={() => {
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
