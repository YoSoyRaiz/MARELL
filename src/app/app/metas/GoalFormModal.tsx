'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Trash2, Repeat, PiggyBank, CalendarClock, LifeBuoy, Sparkles } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  updateGoal,
  clearGoal,
  suggestEmergencyFundAmount,
  type GoalType,
  type EmergencyFundSuggestion,
} from './actions'
import { useFormatMoney } from '../CurrencyProvider'

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
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState('')
  const [customName, setCustomName] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('monthly_spending')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [emergencySuggestion, setEmergencySuggestion] =
    useState<EmergencyFundSuggestion | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)

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
    setEmergencySuggestion(null)
  }, [isOpen, mode, initial, availableCategories])

  // ── Emergency-fund autosuggest ──────────────────────────────────
  // When the user is configuring a category whose name matches "fondo
  // de emergencia", pre-fetch the suggested amount based on their actual
  // expense history. Reactive to both the picked category (add mode)
  // and a renamed customName (edit mode).
  const activeName = (() => {
    if (mode === 'edit' && initial) return customName || initial.categoryName
    const picked = availableCategories.find((c) => c.id === categoryId)
    return customName || picked?.name || ''
  })()
  const isEmergencyFund = /fondo\s*de\s*emergencia/i.test(activeName)

  useEffect(() => {
    if (!isOpen || !isEmergencyFund) return
    let cancelled = false
    setLoadingSuggestion(true)
    suggestEmergencyFundAmount()
      .then((result) => {
        if (cancelled) return
        setEmergencySuggestion(result)
        // For emergency funds, savings_balance is the natural goal type
        // (accumulate to target). Only auto-flip on add — never override
        // an edit where the user might have a deliberate choice.
        if (mode === 'add') setGoalType('savings_balance')
      })
      .catch(() => {
        // Swallow — suggestion is a nice-to-have. UI falls back to
        // manual input.
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestion(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, isEmergencyFund, mode])

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
    (date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date)) &&
    (goalType !== 'needed_by' || /^\d{4}-\d{2}-\d{2}$/.test(date))

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

  const handleClear = async () => {
    if (!initial) return
    const ok = await confirm({
      title: `¿Eliminar la meta de "${initial.categoryName}"?`,
      description:
        'Se borra solo la meta. La categoría y sus transacciones se mantienen intactas.',
      confirmLabel: 'Eliminar meta',
      tone: 'danger',
    })
    if (!ok) return
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-form-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
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
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Category picker — add mode only */}
          {!isEdit && (
            <Field label="Categoría">
              {availableCategories.length === 0 ? (
                <div className="text-[13px] text-[var(--muted)] px-4 py-3 rounded-xl bg-[var(--overlay-1)] border border-[var(--border)]">
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

          {/* Custom name — both modes, always visible */}
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

          {/* Type segmented */}
          <Field label="Tipo de meta">
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setGoalType('monthly_spending')}
                className={`py-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'monthly_spending'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <Repeat size={13} strokeWidth={2.2} />
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setGoalType('savings_balance')}
                className={`py-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'savings_balance'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <PiggyBank size={13} strokeWidth={2.2} />
                Acumulada
              </button>
              <button
                type="button"
                onClick={() => setGoalType('needed_by')}
                className={`py-2.5 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'needed_by'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <CalendarClock size={13} strokeWidth={2.2} />
                Por fecha
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-2">
              {goalType === 'monthly_spending'
                ? 'Apartas este monto cada mes (ej: gimnasio, internet).'
                : goalType === 'savings_balance'
                  ? 'Acumulas hasta llegar al monto total (ej: fondo de emergencia, viajes).'
                  : 'Te decimos cuánto apartar cada mes para llegar a tiempo (ej: boda, prima de casa).'}
            </p>
          </Field>

          {/* Emergency-fund autosuggest: muestra opciones de 3/6/12 meses
              de gastos típicos. Solo aparece cuando la categoría se llama
              "Fondo de emergencia" y hay historial de transacciones. */}
          {isEmergencyFund && (
            <div className="rounded-2xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.05)] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
                  <LifeBuoy size={16} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text)] inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={2.4} className="text-[var(--brand-text)]" />
                    Sugerencia personalizada
                  </div>
                  {loadingSuggestion ? (
                    <div className="text-[12px] text-[var(--muted)] mt-1">
                      Calculando con base en tu historial…
                    </div>
                  ) : emergencySuggestion && emergencySuggestion.basedOnMonths ? (
                    <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
                      Tu gasto promedio mensual es{' '}
                      <span className="text-[var(--text2)] font-medium">
                        {fmtMoney(emergencySuggestion.monthlyAverage)}
                      </span>{' '}
                      ({emergencySuggestion.basedOnMonths}{' '}
                      {emergencySuggestion.basedOnMonths === 1 ? 'mes' : 'meses'} de historial).
                      La regla estándar es apartar entre 3 y 6 meses.
                    </div>
                  ) : (
                    <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
                      Aún no tienes suficiente historial para calcular tu gasto promedio.
                      Empieza con un monto que represente 3-6 meses de tus gastos típicos.
                    </div>
                  )}
                </div>
              </div>

              {emergencySuggestion && emergencySuggestion.options.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {emergencySuggestion.options.map((opt) => {
                    const isPicked = amount === opt.amount
                    return (
                      <button
                        key={opt.months}
                        type="button"
                        onClick={() => setAmount(opt.amount)}
                        className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          isPicked
                            ? 'border-[var(--brand-2)] bg-[rgba(61,220,151,0.10)]'
                            : 'border-[var(--border)] bg-[var(--s1)] hover:border-[var(--border3)] hover:bg-[var(--overlay-1)]'
                        }`}
                      >
                        <span
                          className={`text-[10px] uppercase tracking-[0.12em] font-semibold ${
                            isPicked ? 'text-[var(--brand-text)]' : 'text-[var(--muted)]'
                          }`}
                        >
                          {opt.months} meses
                        </span>
                        <span
                          className={`text-[13px] font-bold tabular-nums num ${
                            isPicked ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {fmtMoney(opt.amount)}
                        </span>
                        <span className="text-[10px] text-[var(--muted2)]">
                          {opt.months === 3
                            ? 'mínimo'
                            : opt.months === 6
                              ? 'recomendado'
                              : 'conservador'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <Field
            label={
              goalType === 'monthly_spending'
                ? 'Monto mensual'
                : goalType === 'needed_by'
                  ? 'Total que necesitas'
                  : 'Monto total objetivo'
            }
          >
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          <Field
            label="Fecha objetivo"
            hint={goalType === 'needed_by' ? 'requerida' : 'opcional'}
          >
            <input
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1.5">
              {goalType === 'needed_by'
                ? 'Fecha en que necesitas tener el dinero completo.'
                : 'Útil para metas con plazo (boda, vacaciones, prima de casa).'}
            </p>
          </Field>

          {/* Edit-only: clear goal */}
          {isEdit && initial && (
            <div className="pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClear}
                disabled={pending}
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl text-[13px] transition-colors disabled:opacity-60 bg-[var(--overlay-1)] hover:bg-[rgba(255,122,89,0.10)] border border-[var(--border)] hover:border-[var(--coral)]/40 text-[var(--text2)] hover:text-[var(--coral-text)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={14} strokeWidth={2} />
                  Eliminar meta
                </span>
                <span className="text-[11px] opacity-70">La categoría se mantiene</span>
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral-text)] shrink-0 mt-0.5" />
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
