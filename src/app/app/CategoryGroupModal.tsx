'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { InlineMoneyEdit } from './plan/InlineMoneyEdit'
import { updateAssignment } from './plan/actions'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useFormatMoney } from './CurrencyProvider'

export interface ModalCategory {
  id: string
  name: string
  /** This month's assignment. */
  assigned: number
  /** This month's activity (signed). */
  activity: number
  /** Lifetime available (carry-over from prior months folded in). */
  available: number
  goal_amount: number | null
}

export interface ModalGroup {
  id: string
  name: string
  categories: ModalCategory[]
}

interface CategoryGroupModalProps {
  isOpen: boolean
  onClose: () => void
  budgetId: string
  month: string
  group: ModalGroup
  onCategoryEdit?: (categoryId: string, next: number) => void
}

export function CategoryGroupModal({
  isOpen,
  onClose,
  budgetId,
  month,
  group,
  onCategoryEdit,
}: CategoryGroupModalProps) {
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const fmtMoney = useFormatMoney()
  const rtaCtx = useReadyToAssign()

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Reset overrides when switching groups
  useEffect(() => {
    if (isOpen) {
      setOverrides({})
      setError(null)
    }
  }, [isOpen, group.id])

  if (!isOpen) return null

  const getAssigned = (c: ModalCategory) =>
    overrides[c.id] !== undefined ? overrides[c.id] : c.assigned
  const totalAssigned = group.categories.reduce((s, c) => s + getAssigned(c), 0)

  const handleSave = async (cat: ModalCategory, next: number) => {
    const previous = getAssigned(cat)
    const delta = next - previous
    setOverrides((p) => ({ ...p, [cat.id]: next }))
    setError(null)
    rtaCtx?.adjust(delta) // optimistic topbar update
    const result = await updateAssignment(budgetId, cat.id, month, next)
    if ('error' in result && result.error) {
      setOverrides((p) => ({ ...p, [cat.id]: previous }))
      rtaCtx?.adjust(-delta)
      setError(result.error)
      window.setTimeout(() => setError(null), 5000)
    } else {
      onCategoryEdit?.(cat.id, next)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        {/* Header */}
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              {group.name}
            </div>
            <h2
              id="category-modal-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              Asigna dinero a tus <span className="gradient-text">categorías</span>
            </h2>
            <div className="text-[12px] text-[var(--muted)] mt-1">
              {group.categories.length}{' '}
              {group.categories.length === 1 ? 'categoría' : 'categorías'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 text-[13px] text-[var(--text)]">
              {error}
            </div>
          )}

          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px] gap-4 px-6 pt-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)]">
            <div>Categoría</div>
            <div className="text-right">Asignado</div>
            <div className="text-right">Disponible</div>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {group.categories.map((c) => {
              const Icon = iconForCategoryName(c.name)
              const assigned = getAssigned(c)
              // Lifetime available + delta from any unsaved local edit on
              // this month's assignment.
              const delta = assigned - c.assigned
              const available = c.available + delta
              const availColor =
                available > 0.005
                  ? 'gradient-text'
                  : available < -0.005
                    ? 'text-[var(--coral)]'
                    : 'text-[var(--muted)]'
              return (
                <li
                  key={c.id}
                  className="px-6 py-3 grid grid-cols-[1fr_120px_100px] items-center gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] text-[var(--text2)] flex items-center justify-center shrink-0">
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] text-[var(--text)] truncate">{c.name}</div>
                      {c.goal_amount && c.goal_amount > 0 && (
                        <div className="text-[11px] text-[var(--muted)] num">
                          meta: ${c.goal_amount.toLocaleString('en-US')}
                        </div>
                      )}
                    </div>
                  </div>
                  <InlineMoneyEdit
                    value={assigned}
                    onSave={(next) => handleSave(c, next)}
                    ariaLabel={`Asignar a ${c.name}`}
                  />
                  <div
                    className={`text-right text-[14px] font-semibold tabular-nums num ${availColor}`}
                  >
                    {fmtMoney(available)}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between gap-4 bg-white/[0.01]">
          <div className="text-[12px] text-[var(--text2)]">
            Total asignado:{' '}
            <span className="num tabular-nums font-semibold text-[var(--text)] ml-1">
              {fmtMoney(totalAssigned)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter]"
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}
