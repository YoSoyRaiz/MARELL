'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { useFormatMoney } from './CurrencyProvider'
import { CategoryDrillModal } from './plan/CategoryDrillModal'
import type { SectionGroup } from './CategoryCardsSection'

interface CategoryAccordionProps {
  groups: SectionGroup[]
}

/**
 * Right-rail accordion that lists category groups; opens the first
 * group by default. The point is to give the dashboard a quick "where
 * is my money" answer without having to leave for /app/plan. Long
 * lists scroll inside the open group instead of pushing the page.
 */
export function CategoryAccordion({ groups }: CategoryAccordionProps) {
  const fmtMoney = useFormatMoney()

  // Default-open the first non-empty group; falls back to the first
  // entry if every group is empty (rare — happens right after
  // onboarding before any category exists).
  const initialOpen =
    groups.find((g) => g.categories.length > 0)?.id ?? groups[0]?.id ?? null
  const [openId, setOpenId] = useState<string | null>(initialOpen)
  // When the user clicks a row, we surface the same drill modal that
  // /app/plan uses (12-month history + totals + transactions).
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null)

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

      <ul className="divide-y divide-[var(--border)]">
        {groups.map((g) => {
          const isOpen = openId === g.id
          const overspent = g.available < -0.005
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
                    Asignado {fmtMoney(g.assigned)}
                  </div>
                </div>
                <span
                  className={`text-[12px] font-semibold tabular-nums num shrink-0 ${
                    overspent
                      ? 'text-[var(--coral-text)]'
                      : 'text-[var(--brand-text)]'
                  }`}
                >
                  {fmtMoney(g.available)}
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
                    <ul className="max-h-[280px] overflow-y-auto">
                      {g.categories.map((c) => {
                        const Icon = iconForCategoryName(c.name)
                        const catOver = c.available < -0.005
                        return (
                          <li
                            key={c.id}
                            className="border-b border-[var(--border)] last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() => setDrillCategoryId(c.id)}
                              aria-label={`Ver historial de ${c.name}`}
                              className="w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-[var(--overlay-1)] transition-colors"
                            >
                              <div className="w-7 h-7 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0">
                                <Icon size={12} strokeWidth={2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-[var(--text)] truncate">
                                  {c.name}
                                </div>
                                <div className="text-[10px] text-[var(--muted)] tabular-nums num">
                                  Asignado {fmtMoney(c.assigned)}
                                </div>
                              </div>
                              <span
                                className={`text-[12px] font-semibold tabular-nums num shrink-0 ${
                                  catOver
                                    ? 'text-[var(--coral-text)]'
                                    : 'text-[var(--text)]'
                                }`}
                              >
                                {fmtMoney(c.available)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
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
    </section>
  )
}
