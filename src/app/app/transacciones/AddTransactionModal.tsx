'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { createTransaction, type TransactionType } from './actions'

interface Account {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: CategoryOption[]
}

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AddTransactionModal({
  isOpen,
  onClose,
  accounts,
  categories,
}: AddTransactionModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState(todayLocal())
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset form whenever the modal opens
  useEffect(() => {
    if (!isOpen) return
    setType('expense')
    setDate(todayLocal())
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setPayeeName('')
    setAmount(null)
    setMemo('')
    setError(null)
  }, [isOpen, accounts])

  // Esc + body scroll lock
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
    /^\d{4}-\d{2}-\d{2}$/.test(date)

  // Group categories by their group_name
  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
    const key = c.group_name
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      const result = await createTransaction({
        accountId,
        categoryId: categoryId || null,
        date,
        payeeName,
        amount,
        memo,
        type,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tx-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              Nueva transacción
            </div>
            <h2 id="add-tx-title" className="text-[20px] font-bold mt-1 leading-tight tracking-tight">
              Agrega un <span className="gradient-text">movimiento</span>
            </h2>
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
          {/* Type segmented */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                type === 'expense'
                  ? 'bg-[var(--coral)]/15 text-[var(--coral)]'
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

          {/* Amount */}
          <Field label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          {/* Date */}
          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          {/* Account */}
          <Field label="Cuenta">
            <NativeSelect
              value={accountId}
              onChange={setAccountId}
              ariaLabel="Cuenta"
            >
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

          {/* Payee */}
          <Field label={type === 'income' ? 'Recibido de' : 'Pagado a'}>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={type === 'income' ? 'Salario, freelance, etc.' : 'Supermercado Nacional, etc.'}
              maxLength={80}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          {/* Category */}
          <Field label="Categoría" hint="opcional">
            <NativeSelect
              value={categoryId}
              onChange={setCategoryId}
              ariaLabel="Categoría"
            >
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

          {/* Memo */}
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
            ) : (
              'Agregar'
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
