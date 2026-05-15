'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Repeat,
  Gift,
  Calculator,
  CreditCard,
} from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import {
  createScheduled,
  updateScheduled,
  type Frequency,
  type ScheduledType,
} from './actions'

interface Account {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

export interface InitialScheduled {
  id: string
  type: ScheduledType
  accountId: string
  categoryId: string | null
  payeeName: string
  amount: number // positive (sign in `type`)
  memo: string | null
  frequency: Frequency
  nextDate: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: CategoryOption[]
  mode: 'add' | 'edit'
  initial?: InitialScheduled
}

const FREQ_LABELS: Record<Frequency, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
  every2weeks: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ScheduledFormModal({
  isOpen,
  onClose,
  accounts,
  categories,
  mode,
  initial,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<ScheduledType>('expense')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [nextDate, setNextDate] = useState(todayLocal())
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setType(initial.type)
      setFrequency(initial.frequency)
      setNextDate(initial.nextDate)
      setAccountId(initial.accountId)
      setCategoryId(initial.categoryId ?? '')
      setPayeeName(initial.payeeName)
      setAmount(initial.amount)
      setMemo(initial.memo ?? '')
    } else {
      setType('expense')
      setFrequency('monthly')
      setNextDate(todayLocal())
      setAccountId(accounts[0]?.id ?? '')
      setCategoryId('')
      setPayeeName('')
      setAmount(null)
      setMemo('')
    }
    setError(null)
  }, [isOpen, mode, initial, accounts])

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
    accountId !== '' &&
    payeeName.trim().length > 0 &&
    amount !== null &&
    amount > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(nextDate)

  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>(
    (acc, c) => {
      const k = c.group_name
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
      return acc
    },
    {},
  )

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      const payload = {
        accountId,
        categoryId: categoryId || null,
        payeeName,
        amount,
        type,
        memo,
        frequency,
        nextDate,
      }
      const result =
        mode === 'edit' && initial
          ? await updateScheduled({ id: initial.id, ...payload })
          : await createScheduled(payload)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const isEdit = mode === 'edit'

  // Pick the next 24-Dec — current year if still ahead, otherwise the
  // following year. Used by the regalía preset.
  const nextDecember24 = (() => {
    const today = new Date()
    const y =
      today.getMonth() < 11 || (today.getMonth() === 11 && today.getDate() <= 24)
        ? today.getFullYear()
        : today.getFullYear() + 1
    return `${y}-12-24`
  })()

  const applyRegaliaPreset = () => {
    setType('income')
    setFrequency('yearly')
    setNextDate(nextDecember24)
    setPayeeName('Regalía pascual')
    setMemo('Sueldo #13 — derecho laboral RD')
  }

  const [installmentOpen, setInstallmentOpen] = useState(false)
  const [installmentTotal, setInstallmentTotal] = useState<string>('')
  const [installmentCount, setInstallmentCount] = useState<string>('')
  const [installmentRate, setInstallmentRate] = useState<string>('')

  const installmentTotalNum = parseFloat(installmentTotal.replace(/[, ]/g, '')) || 0
  const installmentCountNum = parseInt(installmentCount, 10) || 0
  const installmentRateNum = parseFloat(installmentRate.replace(/,/g, '.')) || 0
  /**
   * Standard amortizing-loan formula: P = (i × PV) / (1 − (1+i)^-n) where
   * i is the monthly rate. With i=0 it collapses to PV / n.
   */
  const computedCuota = (() => {
    if (installmentTotalNum <= 0 || installmentCountNum <= 0) return 0
    if (installmentRateNum <= 0) return installmentTotalNum / installmentCountNum
    const i = installmentRateNum / 100 / 12
    const n = installmentCountNum
    return (i * installmentTotalNum) / (1 - Math.pow(1 + i, -n))
  })()

  const applyInstallmentPreset = () => {
    setType('expense')
    setFrequency('monthly')
    setMemo('Cuota mensual — financiamiento')
  }

  const applyCuotaToAmount = () => {
    if (computedCuota > 0) {
      setAmount(Math.round(computedCuota * 100) / 100)
    }
  }

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
        aria-labelledby="sched-form-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
              {isEdit ? 'Editar programada' : 'Nueva programada'}
            </div>
            <h2
              id="sched-form-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              {isEdit ? (
                <>
                  Edita la <span className="gradient-text">recurrencia</span>
                </>
              ) : (
                <>
                  Programa un <span className="gradient-text">movimiento</span>
                </>
              )}
            </h2>
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
          {/* Plantillas RD — only visible in add mode to avoid surprising
              users mid-edit. */}
          {!isEdit && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold mb-2">
                Plantillas RD
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={applyRegaliaPreset}
                  className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-3.5 py-3 flex items-start gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[rgba(245,200,66,0.10)] text-[var(--warn-text)] flex items-center justify-center shrink-0">
                    <Gift size={14} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--text)] leading-tight">
                      Regalía pascual
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                      Llena tipo, frecuencia, fecha (24-dic) y memo. Solo añade el monto y la cuenta.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyInstallmentPreset()
                    setInstallmentOpen(true)
                  }}
                  className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-3.5 py-3 flex items-start gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)] flex items-center justify-center shrink-0">
                    <CreditCard size={14} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--text)] leading-tight">
                      Cuota mensual
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                      Financiamiento a plazos: calcula la cuota y la programa cada mes.
                    </div>
                  </div>
                </button>
              </div>

              {/* Cuotas calculator: input total + n + interest, output the
                  monthly payment. Standard amortizing-loan formula. */}
              {installmentOpen && (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--brand-text)] font-semibold inline-flex items-center gap-1.5">
                      <Calculator size={11} strokeWidth={2.4} />
                      Calculadora de cuotas
                    </div>
                    <button
                      type="button"
                      onClick={() => setInstallmentOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--text)]"
                      aria-label="Cerrar calculadora"
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                        Total
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={installmentTotal}
                        onChange={(e) => setInstallmentTotal(e.target.value)}
                        placeholder="60,000"
                        className="w-full mt-1 !text-[13px] !py-2 !px-2 !rounded-lg tabular-nums num"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                        # cuotas
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                        placeholder="12"
                        className="w-full mt-1 !text-[13px] !py-2 !px-2 !rounded-lg tabular-nums num"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                        Tasa anual %
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={installmentRate}
                        onChange={(e) => setInstallmentRate(e.target.value)}
                        placeholder="0"
                        className="w-full mt-1 !text-[13px] !py-2 !px-2 !rounded-lg tabular-nums num"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-[var(--muted)]">
                      Cuota mensual:{' '}
                      <span className="text-[var(--text)] font-semibold tabular-nums num">
                        {computedCuota > 0
                          ? `$${computedCuota.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : '—'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={applyCuotaToAmount}
                      disabled={computedCuota <= 0}
                      className="text-[11px] font-semibold text-[var(--brand-text)] hover:underline disabled:opacity-40"
                    >
                      Usar este monto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Type segmented */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                type === 'expense'
                  ? 'bg-[var(--coral)]/15 text-[var(--coral-text)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <ArrowDownRight size={14} strokeWidth={2.2} />
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                type === 'income'
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <ArrowUpRight size={14} strokeWidth={2.2} />
              Ingreso
            </button>
          </div>

          <Field label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          <Field
            label="Frecuencia"
            hint={
              frequency === 'once'
                ? 'se ejecuta una sola vez'
                : 'se repite automáticamente'
            }
          >
            <NativeSelect
              value={frequency}
              onChange={(v) => setFrequency(v as Frequency)}
              ariaLabel="Frecuencia"
            >
              {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABELS[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label={frequency === 'once' ? 'Fecha' : 'Próxima fecha'}
            hint={isEdit ? undefined : 'cuando empieza'}
          >
            <input
              type="date"
              value={nextDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNextDate(e.target.value)}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1.5 inline-flex items-center gap-1.5">
              <Repeat size={11} strokeWidth={2} />
              {frequency === 'once'
                ? 'Se materializa una vez en esta fecha.'
                : `Se materializa automáticamente cada ${FREQ_LABELS[frequency].toLowerCase()} a partir de aquí.`}
            </p>
          </Field>

          <Field label="Cuenta">
            <NativeSelect value={accountId} onChange={setAccountId} ariaLabel="Cuenta">
              {accounts.length === 0 ? (
                <option value="" disabled>
                  Sin cuentas
                </option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </NativeSelect>
          </Field>

          <Field label={type === 'income' ? 'Recibido de' : 'Pagado a'}>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Salario, freelance, etc.'
                  : 'Alquiler, Netflix, gimnasio…'
              }
              maxLength={80}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          <Field label="Categoría" hint="opcional">
            <NativeSelect value={categoryId} onChange={setCategoryId} ariaLabel="Categoría">
              <option value="">Sin categoría</option>
              {Object.entries(groupedCategories).map(([groupName, cats]) => (
                <optgroup key={groupName} label={groupName}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Memo" hint="opcional">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Notas adicionales..."
              maxLength={200}
              rows={2}
              className="w-full !text-[14px] !py-2.5 !px-4 !rounded-xl resize-none"
            />
          </Field>

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
              'Programar'
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
