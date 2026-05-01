'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  AlertCircle,
  Split,
  Plus,
  Trash2,
} from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import {
  createTransaction,
  createTransfer,
  updateTransaction,
  suggestCategoryForPayee,
  type SplitInput,
  type TransactionType,
} from './actions'

type EntryType = TransactionType | 'transfer'

interface Account {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

export interface InitialTransaction {
  id: string
  type: TransactionType
  date: string
  accountId: string
  categoryId: string | null
  payeeName: string
  amount: number // positive value (sign is in `type`)
  memo: string | null
  splits?: SplitRow[] // when the transaction is already split
}

export interface SplitRow {
  categoryId: string | null
  amount: number // positive
  memo: string | null
}

const newSplit = (): SplitRow => ({ categoryId: null, amount: 0, memo: null })

interface TransactionFormModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: CategoryOption[]
  mode: 'add' | 'edit'
  initial?: InitialTransaction
}

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TransactionFormModal({
  isOpen,
  onClose,
  accounts,
  categories,
  mode,
  initial,
}: TransactionFormModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<EntryType>('expense')
  const [date, setDate] = useState(todayLocal())
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  // Only used when type === 'transfer'.
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>('')
  const [payeeName, setPayeeName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [memo, setMemo] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [splits, setSplits] = useState<SplitRow[]>([newSplit(), newSplit()])
  const [error, setError] = useState<string | null>(null)
  const [suggestedFromPayee, setSuggestedFromPayee] = useState<string | null>(null)
  const isTransfer = type === 'transfer'

  // Pre-fill on open: from `initial` in edit mode, blank in add mode.
  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setType(initial.type)
      setDate(initial.date)
      setAccountId(initial.accountId)
      setToAccountId(accounts[1]?.id ?? '')
      setCategoryId(initial.categoryId ?? '')
      setPayeeName(initial.payeeName)
      setAmount(initial.amount)
      setMemo(initial.memo ?? '')
      const hasSplits = (initial.splits?.length ?? 0) >= 2
      setSplitMode(hasSplits)
      setSplits(hasSplits ? initial.splits! : [newSplit(), newSplit()])
    } else {
      setType('expense')
      setDate(todayLocal())
      setAccountId(accounts[0]?.id ?? '')
      setToAccountId(accounts[1]?.id ?? '')
      setCategoryId('')
      setPayeeName('')
      setAmount(null)
      setMemo('')
      setSplitMode(false)
      setSplits([newSplit(), newSplit()])
    }
    setError(null)
  }, [isOpen, mode, initial, accounts])

  // Auto-categorize: when the user types a payee name, look up the most
  // common category from prior transactions and auto-fill if the user
  // hasn't picked one yet. Skipped while editing (the existing category
  // is the source of truth) and for transfers/splits.
  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit') return
    if (isTransfer || splitMode) return
    if (categoryId !== '') return
    const name = payeeName.trim()
    if (name.length < 2) {
      setSuggestedFromPayee(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const r = await suggestCategoryForPayee(name)
      if (cancelled) return
      if (r.categoryId && categoryId === '') {
        setCategoryId(r.categoryId)
        setSuggestedFromPayee(r.categoryId)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isOpen, mode, isTransfer, splitMode, payeeName, categoryId])

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

  const splitsSum = splits.reduce(
    (s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0),
    0,
  )
  const splitsBalanced =
    amount !== null && Math.abs(splitsSum - (amount ?? 0)) < 0.005
  const splitsRemainder = amount !== null ? Math.round((amount - splitsSum) * 100) / 100 : 0

  const valid = isTransfer
    ? accountId !== '' &&
      toAccountId !== '' &&
      accountId !== toAccountId &&
      amount !== null &&
      amount > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date)
    : accountId !== '' &&
      payeeName.trim().length > 0 &&
      amount !== null &&
      amount > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      (!splitMode || (splits.length >= 2 && splitsBalanced && splits.every((s) => s.amount > 0)))

  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
    const key = c.group_name
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const updateSplit = (index: number, patch: Partial<SplitRow>) => {
    setSplits((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  const addSplitRow = () => setSplits((prev) => [...prev, newSplit()])
  const removeSplitRow = (index: number) => {
    setSplits((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }
  const distributeRemainder = () => {
    if (amount === null) return
    setSplits((prev) => {
      if (prev.length === 0) return prev
      const last = prev.length - 1
      const others = prev.slice(0, last).reduce((s, r) => s + r.amount, 0)
      const rest = Math.max(0, Math.round((amount - others) * 100) / 100)
      return prev.map((r, i) => (i === last ? { ...r, amount: rest } : r))
    })
  }

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      // Transfer: create a linked pair via createTransfer.
      if (isTransfer) {
        const result = await createTransfer({
          fromAccountId: accountId,
          toAccountId,
          amount,
          date,
          memo,
        })
        if (result && 'error' in result && result.error) {
          setError(result.error)
          return
        }
        router.refresh()
        onClose()
        return
      }

      const splitPayload: SplitInput[] | undefined = splitMode
        ? splits.map((r) => ({
            categoryId: r.categoryId,
            amount: r.amount,
            memo: r.memo,
          }))
        : undefined

      const payload = {
        accountId,
        categoryId: splitMode ? null : categoryId || null,
        date,
        payeeName,
        amount,
        memo,
        type: type as TransactionType,
        splits: splitPayload,
      }
      const result =
        mode === 'edit' && initial
          ? await updateTransaction({ id: initial.id, ...payload })
          : await createTransaction(payload)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-form-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              {isEdit ? 'Editar transacción' : 'Nueva transacción'}
            </div>
            <h2 id="tx-form-title" className="text-[20px] font-bold mt-1 leading-tight tracking-tight">
              {isEdit ? (
                <>
                  Edita el <span className="gradient-text">movimiento</span>
                </>
              ) : (
                <>
                  Agrega un <span className="gradient-text">movimiento</span>
                </>
              )}
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
          {/* Type segmented — Gasto / Ingreso / Transferencia.
              In edit mode the transfer option is hidden because editing a
              transfer pair atomically isn't supported yet (the user can
              delete + recreate). */}
          <div
            className={`grid gap-2 p-1 bg-[var(--bg)] rounded-xl ${
              isEdit ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2.5 rounded-lg text-[12px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
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
              className={`py-2.5 rounded-lg text-[12px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                type === 'income'
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <ArrowUpRight size={14} strokeWidth={2.2} />
              Ingreso
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setType('transfer')}
                className={`py-2.5 rounded-lg text-[12px] sm:text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  isTransfer
                    ? 'bg-[var(--info)]/15 text-[var(--info)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <ArrowLeftRight size={14} strokeWidth={2.2} />
                Transferencia
              </button>
            )}
          </div>

          <Field label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>

          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          <Field label={isTransfer ? 'Cuenta origen' : 'Cuenta'}>
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

          {isTransfer && (
            <Field label="Cuenta destino">
              <NativeSelect
                value={toAccountId}
                onChange={setToAccountId}
                ariaLabel="Cuenta destino"
              >
                {accounts.length < 2 ? (
                  <option value="" disabled>
                    Necesitas al menos 2 cuentas
                  </option>
                ) : (
                  accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))
                )}
              </NativeSelect>
            </Field>
          )}

          {!isTransfer && (
          <Field label={type === 'income' ? 'Recibido de' : 'Pagado a'}>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Salario, freelance, etc.'
                  : 'Supermercado Nacional, etc.'
              }
              maxLength={80}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>
          )}

          {!isTransfer && (!splitMode ? (
            <Field
              label="Categoría"
              hint={
                suggestedFromPayee && categoryId === suggestedFromPayee
                  ? 'sugerida'
                  : 'opcional'
              }
            >
              <NativeSelect
                value={categoryId}
                onChange={(v) => {
                  setCategoryId(v)
                  if (v !== suggestedFromPayee) setSuggestedFromPayee(null)
                }}
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
              {suggestedFromPayee && categoryId === suggestedFromPayee && (
                <p className="text-[11px] text-[var(--brand-2)] mt-1.5 leading-relaxed">
                  Auto-rellenada según tus transacciones anteriores con este pagado.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSplitMode(true)
                  // Seed first split with current category + amount, second blank.
                  setSplits([
                    {
                      categoryId: categoryId || null,
                      amount: amount ?? 0,
                      memo: null,
                    },
                    newSplit(),
                  ])
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text2)] hover:text-[var(--brand-2)] transition-colors"
              >
                <Split size={12} strokeWidth={2.2} />
                Dividir en varias categorías
              </button>
            </Field>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[12px] text-[var(--text2)] font-medium inline-flex items-center gap-1.5">
                  <Split size={12} strokeWidth={2.2} />
                  Split en {splits.length} categorías
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode(false)
                    setSplits([newSplit(), newSplit()])
                  }}
                  className="text-[11px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  Quitar split
                </button>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 divide-y divide-[var(--border)]">
                {splits.map((row, i) => (
                  <div key={i} className="p-3 grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                    <NativeSelect
                      value={row.categoryId ?? ''}
                      onChange={(v) =>
                        updateSplit(i, { categoryId: v || null })
                      }
                      ariaLabel={`Categoría split ${i + 1}`}
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
                    <MoneyInput
                      value={row.amount > 0 ? row.amount : null}
                      onChange={(v) => updateSplit(i, { amount: v ?? 0 })}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => removeSplitRow(i)}
                      disabled={splits.length <= 2}
                      aria-label="Quitar fila"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[rgba(255,122,89,0.10)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addSplitRow}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text2)] hover:text-[var(--brand-2)] transition-colors"
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Añadir categoría
                </button>
                {amount !== null && amount > 0 && (
                  <div className="text-[11px] tabular-nums num">
                    {splitsBalanced ? (
                      <span className="text-[var(--brand-2)] font-semibold">
                        Cuadrado · ${splitsSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : splitsRemainder > 0 ? (
                      <button
                        type="button"
                        onClick={distributeRemainder}
                        className="text-[var(--coral)] font-semibold hover:underline"
                        title="Asignar el resto a la última fila"
                      >
                        Falta ${splitsRemainder.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </button>
                    ) : (
                      <span className="text-[var(--coral)] font-semibold">
                        Sobra ${Math.abs(splitsRemainder).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

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
            ) : isEdit ? (
              'Guardar cambios'
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
