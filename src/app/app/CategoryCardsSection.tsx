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
import { CategoryGroupModal, type ModalGroup, type ModalCategory } from './CategoryGroupModal'

const fmtMoneyShort = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n < -0.005) return `−$${formatted}`
  return `$${formatted}`
}

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
  assigned: number
  spent: number
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
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Categorías</h2>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              Click en un grupo para asignar dinero
            </p>
          </div>
          <Link
            href="/app/plan"
            className="text-[12px] text-[var(--brand-2)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            Ver plan completo <ArrowRight size={12} strokeWidth={2.4} />
          </Link>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {displayGroups.map((g) => {
            const Icon = iconForGroup(g.name)
            const pct = g.assigned > 0 ? Math.min(1, g.spent / g.assigned) : 0
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpenId(g.id)}
                className="group p-5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] text-[var(--text2)] flex items-center justify-center group-hover:text-[var(--brand-2)] transition-colors">
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div className="text-[13px] font-medium text-[var(--text)]">{g.name}</div>
                </div>
                <div className="text-[18px] font-bold tabular-nums num text-[var(--text)]">
                  {fmtMoneyShort(g.spent)}
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  de {fmtMoneyShort(g.assigned)}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full gradient-bg transition-[width] duration-500"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>

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
