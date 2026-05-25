'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, PiggyBank, CalendarClock, LifeBuoy, Sparkles } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { TextInput } from '@/components/ui/TextInput'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  updateGoal,
  clearGoal,
  createMeta,
  suggestEmergencyFundAmount,
  type GoalType,
  type EmergencyFundSuggestion,
} from './actions'
import { useFormatMoney } from '../CurrencyProvider'

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
}

export function GoalFormModal({
  isOpen,
  onClose,
  mode,
  initial,
}: GoalFormModalProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState('')
  const [customName, setCustomName] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('savings_balance')
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
      // Add mode: las metas nuevas son categorías fresh en el grupo
      // "Metas", no se promueve una categoría existente. categoryId se
      // mantiene vacío hasta que el server lo asigne después de crear.
      setCategoryId('')
      setCustomName('')
      setGoalType('savings_balance')
      setAmount(null)
      setDate('')
    }
    setError(null)
    setEmergencySuggestion(null)
  }, [isOpen, mode, initial])

  // ── Sugerencia basada en historial ──────────────────────────────
  // Pre-fetch al abrir el modal: monthly average × N. La sugerencia se
  // muestra para cualquier meta que el usuario quiera estimar a partir
  // de su patrón de gastos típico (no solo "Fondo de emergencia"). El
  // copy y badge se adaptan cuando el nombre menciona explícitamente
  // un fondo de emergencia para dar contexto extra.
  const activeName =
    mode === 'edit' && initial ? customName || initial.categoryName : customName
  const isEmergencyFund = /fondo\s*de\s*emergencia/i.test(activeName)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoadingSuggestion(true)
    suggestEmergencyFundAmount()
      .then((result) => {
        if (cancelled) return
        setEmergencySuggestion(result)
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
  }, [isOpen])

  // Add mode requiere nombre (lo que en add se llamaba "personalizado"
  // pasa a ser el nombre principal de la nueva meta). Edit mode mantiene
  // su flujo: requiere categoryId, customName puede ir vacío.
  const valid =
    (mode === 'edit' ? categoryId !== '' : customName.trim().length > 0) &&
    amount !== null &&
    amount > 0 &&
    (date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date)) &&
    (goalType !== 'needed_by' || /^\d{4}-\d{2}-\d{2}$/.test(date))

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      if (mode === 'add') {
        // En add mode el goalType siempre es savings_balance o needed_by
        // (monthly_spending ya no es opción), así que el narrowing es
        // seguro para createMeta.
        if (goalType !== 'savings_balance' && goalType !== 'needed_by') {
          setError('Tipo de meta inválido')
          return
        }
        const result = await createMeta({
          name: customName.trim(),
          goalType,
          goalAmount: amount,
          goalDate: date || null,
        })
        if (result && 'error' in result && result.error) {
          setError(result.error)
          return
        }
      } else {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="goal-form-title">
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="goal-form-title"
            eyebrow={isEdit ? 'Editar meta' : 'Nueva meta'}
            description={
              isEdit && initial
                ? `${initial.categoryName} · ${initial.groupName}`
                : undefined
            }
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
          </ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Nombre — input principal en add (la meta se crea como categoría
              nueva en el grupo "Metas"), o renombre en edit. */}
          <FormField
            label={isEdit ? 'Nombre' : 'Nombre de la meta'}
            hint={isEdit ? 'edita el nombre' : undefined}
          >
            <TextInput
              type="text"
              value={customName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCustomName(e.target.value)
              }
              maxLength={60}
              autoFocus={!isEdit}
              placeholder={
                isEdit
                  ? initial?.categoryName
                  : 'Ej: Viaje a Punta Cana, Boda, Carro nuevo…'
              }
            />
            <p className="text-eyebrow text-[var(--muted)] leading-relaxed mt-1.5">
              {isEdit
                ? 'Usa un nombre con el que te identifiques en lugar del genérico.'
                : 'Será una nueva meta dentro del grupo "Metas".'}
            </p>
          </FormField>

          {/* Type segmented — solo dos tipos de meta real:
              "Acumulada" (savings_balance) y "Por fecha" (needed_by).
              El tipo "Mensual" (YNAB monthly target) se removió porque
              ese concepto es un presupuesto de gasto, no una meta de
              ahorro — vive en Plan, no en Metas. */}
          <FormField label="Tipo de meta">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setGoalType('savings_balance')}
                className={`py-2.5 rounded-lg text-meta font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
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
                className={`py-2.5 rounded-lg text-meta font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  goalType === 'needed_by'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <CalendarClock size={13} strokeWidth={2.2} />
                Por fecha
              </button>
            </div>
            <p className="text-eyebrow text-[var(--muted)] leading-relaxed mt-2">
              {goalType === 'savings_balance'
                ? 'Acumulas hasta llegar al monto total (ej: fondo de emergencia, viajes).'
                : goalType === 'needed_by'
                  ? 'Te decimos cuánto apartar cada mes para llegar a tiempo (ej: boda, prima de casa).'
                  : 'Selecciona el tipo de meta.'}
            </p>
          </FormField>

          {/* Sugerencia basada en historial — disponible para cualquier
              meta. Calcula 3/6/12 × gasto mensual promedio y los ofrece
              como botones rápidos. Cuando el nombre matchea "fondo de
              emergencia" añade contexto extra (regla 3-6 meses + icono
              LifeBuoy); para otras metas el framing es genérico. */}
          {(loadingSuggestion || emergencySuggestion) && (
            <div className="rounded-2xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.05)] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
                  {isEmergencyFund ? (
                    <LifeBuoy size={16} strokeWidth={2.2} />
                  ) : (
                    <Sparkles size={16} strokeWidth={2.2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm font-semibold text-[var(--text)] inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={2.4} className="text-[var(--brand-text)]" />
                    Sugerencia basada en tu historial
                  </div>
                  {loadingSuggestion ? (
                    <div className="text-meta text-[var(--muted)] mt-1">
                      Calculando con base en tu historial…
                    </div>
                  ) : emergencySuggestion && emergencySuggestion.basedOnMonths ? (
                    <div className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
                      Tu gasto promedio mensual es{' '}
                      <span className="text-[var(--text2)] font-medium">
                        {fmtMoney(emergencySuggestion.monthlyAverage)}
                      </span>{' '}
                      ({emergencySuggestion.basedOnMonths}{' '}
                      {emergencySuggestion.basedOnMonths === 1 ? 'mes' : 'meses'} de historial).
                      {isEmergencyFund
                        ? ' Para un fondo de emergencia, la regla estándar es 3-6 meses.'
                        : ' Estima cuántos meses de gastos quieres acumular para esta meta.'}
                    </div>
                  ) : (
                    <div className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
                      Aún no tienes suficiente historial para calcular tu gasto promedio.
                      {isEmergencyFund
                        ? ' Empieza con un monto que represente 3-6 meses de tus gastos típicos.'
                        : ' Define el monto manualmente abajo.'}
                    </div>
                  )}
                </div>
              </div>

              {emergencySuggestion && emergencySuggestion.options.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {emergencySuggestion.options.map((opt) => {
                    const isPicked = amount === opt.amount
                    // Solo mostramos las etiquetas (mínimo/recomendado/
                    // conservador) cuando el contexto es fondo de
                    // emergencia — para otras metas no aplican.
                    const sublabel = !isEmergencyFund
                      ? null
                      : opt.months === 3
                        ? 'mínimo'
                        : opt.months === 6
                          ? 'recomendado'
                          : 'conservador'
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
                          className={`text-tiny uppercase tracking-[0.12em] font-semibold ${
                            isPicked ? 'text-[var(--brand-text)]' : 'text-[var(--muted)]'
                          }`}
                        >
                          {opt.months} meses
                        </span>
                        <span
                          className={`text-body-sm font-bold tabular-nums num ${
                            isPicked ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {fmtMoney(opt.amount)}
                        </span>
                        {sublabel && (
                          <span className="text-tiny text-[var(--muted2)]">
                            {sublabel}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <FormField
            label={
              goalType === 'monthly_spending'
                ? 'Monto mensual'
                : goalType === 'needed_by'
                  ? 'Total que necesitas'
                  : 'Monto total objetivo'
            }
          >
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </FormField>

          <FormField
            label="Fecha objetivo"
            hint={goalType === 'needed_by' ? 'requerida' : 'opcional'}
          >
            <TextInput
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
            />
            <p className="text-eyebrow text-[var(--muted)] leading-relaxed mt-1.5">
              {goalType === 'needed_by'
                ? 'Fecha en que necesitas tener el dinero completo.'
                : 'Útil para metas con plazo (boda, vacaciones, prima de casa).'}
            </p>
          </FormField>

          {/* Edit-only: clear goal */}
          {isEdit && initial && (
            <div className="pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClear}
                disabled={pending}
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl text-body-sm transition-colors disabled:opacity-60 bg-[var(--overlay-1)] hover:bg-[rgba(255,122,89,0.10)] border border-[var(--border)] hover:border-[var(--coral)]/40 text-[var(--text2)] hover:text-[var(--coral-text)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={14} strokeWidth={2} />
                  Eliminar meta
                </span>
                <span className="text-eyebrow opacity-70">La categoría se mantiene</span>
              </button>
            </div>
          )}

          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleSubmit}
            disabled={!valid || pending}
          >
            {pending ? (
              <>
                <Spinner />
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Crear meta'
            )}
          </Button>
        </ModalFooter>
    </Modal>
  )
}

