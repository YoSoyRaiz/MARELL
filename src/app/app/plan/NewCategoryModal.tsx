'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, FolderPlus } from 'lucide-react'
import { createCategory } from './actions'

interface GroupOption {
  id: string
  name: string
}

interface NewCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  budgetId: string
  groups: GroupOption[]
  /** Optional default group preselect — used when the user clicks "+" inside a specific group row. */
  defaultGroupId?: string
}

/**
 * Modal liviano para crear una categoría ad-hoc desde Plan. La
 * categoría se añade al final del grupo seleccionado. Si el grupo es
 * "Metas", el server action le asigna goal_type='savings_balance'
 * automáticamente (consistente con onboarding).
 */
export function NewCategoryModal({
  isOpen,
  onClose,
  budgetId,
  groups,
  defaultGroupId,
}: NewCategoryModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset al abrir; selecciona el grupo por defecto. Si no se pasó uno,
  // intenta esquivar "Metas" (categorías ad-hoc rara vez son metas).
  useEffect(() => {
    if (!isOpen) return
    setName('')
    setError(null)
    if (defaultGroupId && groups.find((g) => g.id === defaultGroupId)) {
      setGroupId(defaultGroupId)
    } else {
      const nonMetas = groups.find((g) => g.name !== 'Metas')
      setGroupId(nonMetas?.id ?? groups[0]?.id ?? '')
    }
  }, [isOpen, groups, defaultGroupId])

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

  if (!isOpen) return null

  const valid = name.trim().length > 0 && groupId !== ''

  const handleSubmit = () => {
    if (!valid) return
    setError(null)
    startTransition(async () => {
      const result = await createCategory({
        budgetId,
        groupId,
        name: name.trim(),
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const selectedGroup = groups.find((g) => g.id === groupId)
  const isMetasGroup = selectedGroup?.name === 'Metas'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-category-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] inline-flex items-center gap-1.5">
              <FolderPlus size={11} strokeWidth={2.4} />
              Nueva categoría
            </div>
            <h2
              id="new-category-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              Agrega una <span className="gradient-text">categoría</span>
            </h2>
            <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              Para gastos que no encajan en ninguna categoría existente.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Nombre">
            <input
              type="text"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ej: Suscripciones, Mascota, Mudanza…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid && !pending) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          <Field label="Grupo">
            <NativeSelect value={groupId} onChange={setGroupId} ariaLabel="Grupo">
              {groups.length === 0 ? (
                <option value="" disabled>
                  Sin grupos
                </option>
              ) : (
                groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </NativeSelect>
            {isMetasGroup && (
              <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-2">
                Las categorías del grupo Metas no aparecen en Plan — las
                configuras y trackeas desde la sección Metas.
              </p>
            )}
          </Field>

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle
                size={16}
                strokeWidth={2}
                className="text-[var(--coral-text)] shrink-0 mt-0.5"
              />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--overlay-1)]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] rounded-lg transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || pending}
            className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
                Creando…
              </>
            ) : (
              'Crear categoría'
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
      </label>
      {children}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full appearance-none !text-[14px] !py-3 !pl-4 !pr-10 !rounded-xl bg-[var(--s1)] cursor-pointer"
      >
        {children}
      </select>
      <svg
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text2)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
