'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, FolderInput, X, ChevronDown } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  bulkDeleteTransactions,
  bulkUpdateCategory,
  type BulkResult,
} from './actions'

export interface BulkCategoryOption {
  id: string
  name: string
  group_name: string
}

interface BulkActionBarProps {
  ids: string[]
  categories: BulkCategoryOption[]
  onClear: () => void
}

export function BulkActionBar({ ids, categories, onClear }: BulkActionBarProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'delete' | 'recategorize' | null>(null)

  const handleDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar ${ids.length} ${ids.length === 1 ? 'transacción' : 'transacciones'}?`,
      description:
        'Reviértimos los montos en cada cuenta y los pares de transferencia se borran completos. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    setHint(null)
    setPendingAction('delete')
    startTransition(async () => {
      const r: BulkResult = await bulkDeleteTransactions(ids)
      setPendingAction(null)
      if (r.error) {
        setError(r.error)
        return
      }
      onClear()
      router.refresh()
    })
  }

  const handleRecategorize = (categoryId: string | null) => {
    setError(null)
    setHint(null)
    setPendingAction('recategorize')
    startTransition(async () => {
      const r: BulkResult = await bulkUpdateCategory(ids, categoryId)
      setPendingAction(null)
      if (r.error) {
        setError(r.error)
        return
      }
      if (r.skipped && r.skipped > 0) {
        setHint(
          r.reasonSummary ??
            `Se cambió la categoría de ${r.succeeded ?? 0}; ${r.skipped} omitidas.`,
        )
      }
      setPickerOpen(false)
      onClear()
      router.refresh()
    })
  }

  // Group categories for the picker.
  const grouped = categories.reduce<Record<string, BulkCategoryOption[]>>(
    (acc, c) => {
      const k = c.group_name
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
      return acc
    },
    {},
  )

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-auto z-40 max-w-md mx-auto sm:mx-0">
      <div className="rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-[var(--text)] font-semibold">
            {ids.length} {ids.length === 1 ? 'seleccionada' : 'seleccionadas'}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-[var(--text2)] hover:text-[var(--text)] w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.04] transition-colors"
            aria-label="Limpiar selección"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={pending}
              className="w-full h-10 px-3 text-[12px] font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {pendingAction === 'recategorize' ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Aplicando…
                </>
              ) : (
                <>
                  <FolderInput size={13} strokeWidth={2.2} />
                  Recategorizar
                  <ChevronDown
                    size={12}
                    strokeWidth={2.4}
                    className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>
            {pickerOpen && (
              <div className="absolute bottom-full mb-2 left-0 right-0 max-h-[250px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={() => handleRecategorize(null)}
                  className="w-full text-left px-3 py-2 text-[12px] text-[var(--text2)] hover:bg-white/[0.04] hover:text-[var(--text)] transition-colors"
                >
                  Sin categoría
                </button>
                {Object.entries(grouped).map(([gname, cats]) => (
                  <div key={gname} className="border-t border-[var(--border)]">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[var(--brand-2)] font-semibold bg-white/[0.02]">
                      {gname}
                    </div>
                    {cats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleRecategorize(c.id)}
                        className="w-full text-left px-3 py-2 text-[12px] text-[var(--text)] hover:bg-white/[0.04] transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="h-10 px-3 text-[12px] font-semibold rounded-xl bg-[var(--coral)]/15 hover:bg-[var(--coral)]/25 text-[var(--coral)] border border-[var(--coral)]/30 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {pendingAction === 'delete' ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[var(--coral)]/30 border-t-[var(--coral)] animate-spin" />
                Borrando…
              </>
            ) : (
              <>
                <Trash2 size={13} strokeWidth={2.2} />
                Borrar
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="text-[11px] text-[var(--coral)] leading-relaxed">{error}</div>
        )}
        {hint && (
          <div className="text-[11px] text-[var(--muted)] leading-relaxed">{hint}</div>
        )}
      </div>
    </div>
  )
}
