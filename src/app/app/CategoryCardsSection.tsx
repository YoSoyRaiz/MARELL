'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Receipt,
  ShoppingBag,
  Palette,
  Target,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'
import { CategoryGroupModal, type ModalGroup, type ModalCategory } from './CategoryGroupModal'
import { useFormatMoneyShort } from './CurrencyProvider'

const iconForGroup = (name: string): LucideIcon => {
  switch (name) {
    case 'Facturas':
      return Receipt
    case 'Necesidades':
      return ShoppingBag
    case 'Gustos':
      return Palette
    case 'Metas':
      return Target
    default:
      return Tag
  }
}

export interface SectionGroup extends ModalGroup {
  /** Sum of this-month assignments across the group's categories. */
  assigned: number
  /** Sum of this-month spending (positive number). */
  spent: number
  /**
   * Lifetime "Available" — Σ(assignments all months) + Σ(activity all time).
   * This is what's actually left to spend, including carry-over from prior
   * months. Negative when overspent.
   */
  available: number
}

interface CategoryCardsSectionProps {
  budgetId: string
  month: string
  groups: SectionGroup[]
}

export function CategoryCardsSection({
  budgetId,
  month,
  groups,
}: CategoryCardsSectionProps) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, number>>({})
  const fmtMoneyShort = useFormatMoneyShort()

  // Optimistically merge edits into the group totals so the cards
  // reflect saves made inside the modal until the next refresh.
  const displayGroups = useMemo(() => {
    if (Object.keys(edits).length === 0) return groups
    return groups.map((g) => {
      const updatedCategories = g.categories.map((c) =>
        edits[c.id] !== undefined ? { ...c, assigned: edits[c.id] } : c,
      )
      const assigned = updatedCategories.reduce((s, c) => s + c.assigned, 0)
      return { ...g, categories: updatedCategories, assigned }
    })
  }, [groups, edits])

  const openGroup = displayGroups.find((g) => g.id === openId) ?? null

  const handleClose = () => {
    setOpenId(null)
    // Refresh the server data to capture the saved edits across the rest of the page.
    router.refresh()
  }

  const handleEdit = (catId: string, next: number) => {
    setEdits((prev) => ({ ...prev, [catId]: next }))
  }

  return (
    <>
      <Card as="section" className="overflow-hidden">
        <CardHeader gap="none">
          <div>
            <h2 className="text-emph font-semibold text-[var(--text)]">Categorías</h2>
            <p className="text-meta text-[var(--muted)] mt-0.5">
              Click en un grupo para asignar dinero
            </p>
          </div>
          <Link
            href="/app/plan"
            className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            Ver plan completo <ArrowRight size={12} strokeWidth={2.4} />
          </Link>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {displayGroups.map((g) => {
            const Icon = iconForGroup(g.name)
            // Use lifetime available (carry-over folded in) so a group with
            // saved-up balance from previous months doesn't read as "Aún
            // sin asignar" just because nothing was assigned this month.
            const isUnassigned =
              g.assigned <= 0.005 &&
              g.spent <= 0.005 &&
              Math.abs(g.available) <= 0.005
            const isOverspent = g.available < -0.005
            const pct = g.assigned > 0 ? Math.min(1, g.spent / g.assigned) : 0
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpenId(g.id)}
                className="group p-5 hover:bg-[var(--overlay-1)] transition-colors text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center group-hover:text-[var(--brand-text)] transition-colors">
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div className="text-body-sm font-medium text-[var(--text)]">{g.name}</div>
                </div>
                {isUnassigned ? (
                  <>
                    <div className="text-emph font-semibold text-[var(--muted)] leading-snug">
                      Aún sin asignar
                    </div>
                    <div className="text-eyebrow text-[var(--brand-text)] mt-1 group-hover:underline underline-offset-4">
                      Click para asignar →
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                      {isOverspent ? 'Excedido' : 'Disponible'}
                    </div>
                    <div
                      className={`text-h2 font-bold tabular-nums num leading-none mt-0.5 ${
                        isOverspent ? 'text-[var(--coral-text)]' : 'gradient-text'
                      }`}
                    >
                      {fmtMoneyShort(g.available)}
                    </div>
                    <div className="text-eyebrow text-[var(--muted)] mt-1.5 num tabular-nums">
                      {fmtMoneyShort(g.spent)} gastado este mes · {fmtMoneyShort(g.assigned)}{' '}
                      asignado
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-[var(--overlay-1)] overflow-hidden">
                      <div
                        className="h-full gradient-bg transition-[width] duration-500"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {openGroup && (
        <CategoryGroupModal
          isOpen={!!openGroup}
          onClose={handleClose}
          budgetId={budgetId}
          month={month}
          group={openGroup}
          onCategoryEdit={handleEdit}
        />
      )}
    </>
  )
}
