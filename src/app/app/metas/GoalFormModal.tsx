'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Trash2, Repeat, PiggyBank } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { updateGoal, clearGoal, type GoalType } from './actions'

export interface CategoryOption {
  id: string
  name: string
  group_name: string
}

export interface InitialGoal {
  categoryId: string
  categoryName: string
  groupName: string
  goalType: GoalType
  goalAmount: number
  goalDate: string | null
}

interface GoalFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  initial?: InitialGoal
  // Only required in add mode; lists categories that don't have a goal yet
  availableCategories?: CategoryOption[]
}

export function GoalFormModal({
  isOpen,
  onClose,
  mode,
  initial,
  availableCategories = [],
}: GoalFormModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState('')
  const [customName, setCustomName] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('monthly_spending')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setCategoryId(initial.categoryId)
      setCustomName(initial.categoryName)
      setGoalType(initial.goalType)
      setAmount(initial.goalAmount)
      setDate(initial.goalDate ?? '')
    } else {
      setCategoryId(availableCategories[0]?.id ?? '')
      setCustomName('')
      setGoalType('monthly_spending')
      setAmount(null)
      setDate('')
    }
    setError(null)
    setConfirmingClear(false)
  }, [isOpen, mode, initial, availableCategories])

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

  const valid =
    categoryId !== '' &&
    amount !== null &&
    amount > 0 &&
    (date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date))

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      const result = await updateGoal({
        categoryId,
        goalType,
        goalAmount: amount,
        goalDate: date || null,
        customName: customName.trim() || null,
      })
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const handleClear = () => {
    if (!initial) return
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await clearGoal(initial.categoryId)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const isEdit = mode === 'edit'
  // Group categories for the picker (add mode only)
  const groupedCats = availableCategories.reduce<Record<string, CategoryOption[]>>(
    (acc, c) => {
      const k = c.group_name
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
      return acc
    },
    {},
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-form-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              {isEdit ? 'Editar meta' : 'Nueva meta'}
            </div>
            <h2
              id="goal-form-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              {isEdit ? (
                <>
                  Ajusta tu <span className="gradient-text">objetivo</span>
                </>
              ) : (
                <>
                  Define tu <span className="gradient-text">meta</span>
                </>
              )}
            </h2>
            {isEdit && initial && (
              <div className="text-[12px] text-[var(--muted)] mt-1">
                {initial.categoryName} · {initial.groupName}
              </div>
            )}
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Category picker — add mode only */}
          {!isEdit && (
            <Field label="Categoría">
              {availableCategories.length === 0 ? (
                <div className="text-[13px] text-[var(--muted)] px-4 py-3 rounded-xl bg-white/[0.02] border border-[var(--border)]">
                  Todas tus categorías ya tienen meta. Edita una existente para ajustar.
                </div>
              ) : (
                <NativeSelect
                  value={categoryId}
                  onChange={setCategoryId}
                  ariaLabel="Categoría"
                >
                  {Object.entries(groupedCats).map(([groupName, cats]) => (
                    <optgroup key={groupName} label={groupName}>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}

          {/* Custom name — both modes */}
          {(isEdit || availableCategories.length > 0) && (
            <Field
              label="Nombre personalizado"
              hint={isEdit ? 'edita el nombre' : 'opcional'}
            >
              <input
                type="text"
                value={customName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setCustomName(e.target.value)
                }
                maxLength={60}
                placeholder={
                  isEdit
                    ? initial?.categoryName
                    : 'Ej: Gimnasio del barrio, Viaje a Punta Cana…'
                }
                className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
              />
              <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1.5">
                Usa un nombre con el que te identifiques en lugar del genérico.
              </p>
            </Field>
          )}

          {/* Type segmented */}
          <Field label="Tipo de meta">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setGoalType('monthly_spending')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'monthly_spending'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <Repeat size={14} strokeWidth={2.2} />
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setGoalType('savings_balance')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'savings_balance'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <PiggyBank size={14} strokeWidth={2.2} />
                Acumulada
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-2">
              {goalType === 'monthly_spending'
                ? 'Apartas este monto cada mes (ej: gimnasio, internet).'
                : 'Acumulas hasta llegar al monto total (ej: fondo de emergencia, vacaciones).'}
            </p>
          </Field>

          <Field
            label={goalType === 'monthly_spending' ? 'Monto mensual' : 'Monto total objetivo'}
          >
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          <Field label="Fecha objetivo" hint="opcional">
            <input
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1.5">
              Útil para metas con plazo (boda, vacaciones, prima de casa).
            </p>
          </Field>

          {/* Edit-only: clear goal */}
          {isEdit && initial && (
            <div className="pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClear}
                disabled={pending}
                className={`w-full inline-flex items-center justify-between px-4 py-3 rounded-xl text-[13px] transition-colors disabled:opacity-60 ${
                  confirmingClear
                    ? 'bg-[rgba(255,122,89,0.10)] border border-[var(--coral)]/40 text-[var(--coral)] hover:bg-[rgba(255,122,89,0.18)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.05] border border-[var(--border)] hover:border-[var(--coral)]/40 text-[var(--text2)] hover:text-[var(--coral)]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={14} strokeWidth={2} />
                  {confirmingClear ? 'Confirmar: eliminar meta' : 'Eliminar meta'}
                </span>
                <span className="text-[11px] opacity-70">
                  {confirmingClear ? 'La categoría se mantiene' : 'Click para confirmar'}
                </span>
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-60"
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
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Crear meta'
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
        {hint && <span className="text-[var(--muted)] font-normal">({hint})</span>}
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
