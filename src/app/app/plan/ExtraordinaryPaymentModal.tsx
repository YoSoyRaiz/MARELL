'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Calendar } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { createScheduled, type ScheduledType } from '../programadas/actions'
import { MONTH_NAMES_FULL } from '@/lib/dates'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface ExtraordinaryPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  /** YYYY (4-digit year) — modal limits its month picker to this year. */
  year: number
  /** Optional default month (1-12) — used when opened from a specific month row. */
  defaultMonth?: number
  accounts: AccountOption[]
  categories: CategoryOption[]
}

// MONTH_NAMES_FULL importado desde @/lib/dates.

/**
 * Crea un "pago extraordinario": una transacción programada one-off
 * que ocurre el día 1 del mes elegido. Reutiliza `createScheduled` por
 * dentro — el extraordinary es solo una vista distinta de un scheduled
 * con frequency='once'.
 */
export function ExtraordinaryPaymentModal({
  isOpen,
  onClose,
  year,
  defaultMonth,
  accounts,
  categories,
}: ExtraordinaryPaymentModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [month, setMonth] = useState<number>(defaultMonth ?? new Date().getMonth() + 1)
  const [day, setDay] = useState<number>(1)
  const [type, setType] = useState<ScheduledType>('expense')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setMonth(defaultMonth ?? new Date().getMonth() + 1)
    setDay(1)
    setType('expense')
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setPayeeName('')
    setAmount(null)
    setMemo('')
    setError(null)
  }, [isOpen, accounts, defaultMonth])

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

  // Día máximo válido depende del mes (ene=31, feb=28/29, etc.).
  // Simple aproximación: usar el último día real construyendo Date(year, month, 0).
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfMonth)

  const grouped = categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
    const k = c.group_name
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  const valid =
    accountId !== '' &&
    payeeName.trim() !== '' &&
    amount !== null &&
    amount > 0 &&
    month >= 1 &&
    month <= 12

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    const nextDate = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
    startTransition(async () => {
      const result = await createScheduled({
        accountId,
        categoryId: categoryId || null,
        payeeName: payeeName.trim(),
        amount,
        type,
        memo: memo.trim() || null,
        frequency: 'once',
        nextDate,
      })
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
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
        aria-labelledby="extra-payment-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] inline-flex items-center gap-1.5">
              <Calendar size={11} strokeWidth={2.4} />
              Pago extraordinario · {year}
            </div>
            <h2
              id="extra-payment-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              Programa un <span className="gradient-text">pago único</span>
            </h2>
            <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              Para gastos que no se repiten cada mes (seguro auto, matrícula,
              prima, etc.).
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
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  type === 'expense'
                    ? 'bg-[var(--s1)] text-[var(--text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  type === 'income'
                    ? 'bg-[var(--s1)] text-[var(--text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Ingreso
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mes">
              <NativeSelect
                value={String(month)}
                onChange={(v) => setMonth(parseInt(v, 10))}
                ariaLabel="Mes"
              >
                {MONTH_NAMES_FULL.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Día">
              <input
                type="number"
                value={clampedDay}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = parseInt(e.target.value, 10)
                  if (Number.isFinite(v) && v >= 1 && v <= lastDayOfMonth) {
                    setDay(v)
                  }
                }}
                min={1}
                max={lastDayOfMonth}
                className="w-full !text-[14px] !py-3 !px-4 !rounded-xl tabular-nums"
              />
            </Field>
          </div>

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

          <Field label="Categoría" hint="opcional">
            <NativeSelect
              value={categoryId}
              onChange={setCategoryId}
              ariaLabel="Categoría"
            >
              <option value="">Sin categoría</option>
              {Object.entries(grouped).map(([groupName, cats]) => (
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

          <Field label="Pagado a">
            <input
              type="text"
              value={payeeName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPayeeName(e.target.value)
              }
              maxLength={80}
              placeholder="Ej: Seguro vehicular, Matrícula escolar…"
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          <Field label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          <Field label="Notas" hint="opcional">
            <input
              type="text"
              value={memo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMemo(e.target.value)}
              maxLength={200}
              placeholder="Detalles adicionales…"
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
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
                Guardando…
              </>
            ) : (
              'Programar pago'
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
