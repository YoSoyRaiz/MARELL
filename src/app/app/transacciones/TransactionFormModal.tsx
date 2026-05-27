'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Split,
  Plus,
  Trash2,
} from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import {
  createTransaction,
  createTransfer,
  updateTransaction,
  updateTransfer,
  suggestCategoryForPayee,
  type SplitInput,
  type TransactionType,
} from './actions'
import { ReceiptCapture } from './ReceiptCapture'
import { ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { IconButton } from '@/components/ui/IconButton'
import { FormField } from '@/components/ui/FormField'
import { NativeSelect } from '@/components/ui/NativeSelect'
import { Spinner } from '@/components/ui/Spinner'

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
  /** Discriminator for the form. 'transfer' lets the user edit a paired
      transfer's amount/accounts/date/memo. */
  type: TransactionType | 'transfer'
  date: string
  accountId: string
  /** Only meaningful when type='transfer'. The other side of the pair. */
  toAccountId?: string
  categoryId: string | null
  payeeName: string
  amount: number // positive value (sign is in `type`)
  memo: string | null
  receiptUrl?: string | null
  receiptPath?: string | null
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
  /** When true, hide Categoría / Split / Memo on mobile so the
   *  formulario quepa sin scroll. Used by the mobile FAB quick-add
   *  flow. The user can categorize later from the Movimientos list. */
  compactMobile?: boolean
  /** Called after a successful save with the saved transaction's
   *  ISO date (YYYY-MM-DD). Lets the parent jump to the right month
   *  filter so the user sees the row they just created. */
  onSaved?: (savedDate: string) => void
  /** Optional defaults for "add" mode. Used by quick-pay flows that
   *  open the form from a category row pre-filling category + account
   *  so the user only needs to type amount + payee. Ignored in edit
   *  mode (initial has priority). */
  defaultCategoryId?: string | null
  defaultAccountId?: string | null
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
  compactMobile = false,
  onSaved,
  defaultCategoryId = null,
  defaultAccountId = null,
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
  const [receipt, setReceipt] = useState<{ url: string; path: string } | null>(
    null,
  )
  const isTransfer = type === 'transfer'

  // Pre-fill on open: from `initial` in edit mode, blank in add mode.
  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setType(initial.type)
      setDate(initial.date)
      setAccountId(initial.accountId)
      setToAccountId(initial.toAccountId ?? accounts[1]?.id ?? '')
      setCategoryId(initial.categoryId ?? '')
      setPayeeName(initial.payeeName)
      setAmount(initial.amount)
      setMemo(initial.memo ?? '')
      setReceipt(
        initial.receiptUrl && initial.receiptPath
          ? { url: initial.receiptUrl, path: initial.receiptPath }
          : null,
      )
      const hasSplits = (initial.splits?.length ?? 0) >= 2
      setSplitMode(hasSplits)
      setSplits(hasSplits ? initial.splits! : [newSplit(), newSplit()])
    } else {
      setType('expense')
      setDate(todayLocal())
      // Honor caller-provided defaults (quick-pay flow from a
      // category row); fall back to the first account if none.
      setAccountId(defaultAccountId ?? accounts[0]?.id ?? '')
      setToAccountId(accounts[1]?.id ?? '')
      setCategoryId(defaultCategoryId ?? '')
      setPayeeName('')
      setAmount(null)
      setMemo('')
      setReceipt(null)
      setSplitMode(false)
      setSplits([newSplit(), newSplit()])
    }
    setError(null)
  }, [isOpen, mode, initial, accounts, defaultCategoryId, defaultAccountId])

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
  const splitsSum = splits.reduce(
    (s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0),
    0,
  )
  const splitsBalanced =
    amount !== null && Math.abs(splitsSum - (amount ?? 0)) < 0.005
  const splitsRemainder = amount !== null ? Math.round((amount - splitsSum) * 100) / 100 : 0

  // Payee/comercio es opcional siempre — si la categoría ya está elegida
  // (flujo más común desde la card de categoría), pedir un comercio extra
  // es fricción innecesaria. Cuando viene vacío, el server pone un
  // fallback sensible ("Sin comercio" o similar).
  const valid = isTransfer
    ? accountId !== '' &&
      toAccountId !== '' &&
      accountId !== toAccountId &&
      amount !== null &&
      amount > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date)
    : accountId !== '' &&
      amount !== null &&
      amount > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      (!splitMode || (splits.length >= 2 && splitsBalanced && splits.every((s) => s.amount > 0)))

  // Spell out which fields are missing so the user knows why the
  // Agregar button is greyed out — saves the "no sé por qué no me deja"
  // back-and-forth.
  const missingFields: string[] = []
  if (accountId === '') missingFields.push('cuenta')
  if (amount === null || amount <= 0) missingFields.push('monto')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) missingFields.push('fecha válida')
  if (isTransfer) {
    if (toAccountId === '') missingFields.push('cuenta destino')
    if (accountId !== '' && accountId === toAccountId) missingFields.push('cuentas distintas')
  } else {
    if (splitMode) {
      if (splits.length < 2 || !splits.every((s) => s.amount > 0)) {
        missingFields.push('split completo')
      } else if (!splitsBalanced) {
        missingFields.push('split cuadrado')
      }
    }
  }

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

  /**
   * Distribute the parent amount equally across every split row,
   * sweeping any rounding remainder into the last row so the sum
   * matches exactly. Common case: 50/50, 33/33/33, etc.
   */
  const equalizeSplits = () => {
    if (amount === null || amount <= 0) return
    setSplits((prev) => {
      if (prev.length === 0) return prev
      const each = Math.floor((amount / prev.length) * 100) / 100
      const sumExceptLast = each * (prev.length - 1)
      const lastAmount = Math.round((amount - sumExceptLast) * 100) / 100
      return prev.map((r, i) => ({
        ...r,
        amount: i === prev.length - 1 ? lastAmount : each,
      }))
    })
  }

  /**
   * Apply a percentage distribution to the rows. `percentages` length
   * must match splits.length and total ~100. Last row absorbs any
   * rounding drift so the sum equals the parent total.
   */
  const distributeByPercentages = (percentages: number[]) => {
    if (amount === null || amount <= 0) return
    if (percentages.length !== splits.length) return
    const total = percentages.reduce((s, p) => s + p, 0)
    if (Math.abs(total - 100) > 0.5) return
    setSplits((prev) => {
      const computed = percentages.map((p) =>
        Math.floor(((amount * p) / 100) * 100) / 100,
      )
      const sumExceptLast = computed.slice(0, -1).reduce((s, n) => s + n, 0)
      const lastAmount = Math.round((amount - sumExceptLast) * 100) / 100
      return prev.map((r, i) => ({
        ...r,
        amount: i === prev.length - 1 ? lastAmount : computed[i],
      }))
    })
  }

  const handleSubmit = () => {
    if (!valid || amount === null) return
    setError(null)
    startTransition(async () => {
      // Transfer: create or update the linked pair.
      if (isTransfer) {
        const result =
          mode === 'edit' && initial
            ? await updateTransfer({
                id: initial.id,
                fromAccountId: accountId,
                toAccountId,
                amount,
                date,
                memo,
                categoryId: categoryId || null,
              })
            : await createTransfer({
                fromAccountId: accountId,
                toAccountId,
                amount,
                date,
                memo,
                categoryId: categoryId || null,
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
        receiptUrl: receipt?.url ?? null,
        receiptPath: receipt?.path ?? null,
      }
      try {
        const result =
          mode === 'edit' && initial
            ? await updateTransaction({ id: initial.id, ...payload })
            : await createTransaction(payload)
        if (result && 'error' in result && result.error) {
          setError(result.error)
          return
        }
        // Tell the parent which date we saved at — it can switch the
        // month filter so the new row is actually visible.
        onSaved?.(date)
        router.refresh()
        onClose()
      } catch (e) {
        // Without this catch a thrown error inside startTransition gets
        // swallowed and the user sees nothing — modal just stays open.
        console.error('createTransaction threw', e)
        setError(
          e instanceof Error
            ? `Error: ${e.message}`
            : 'No pudimos guardar — intenta de nuevo.',
        )
      }
    })
  }

  const isEdit = mode === 'edit'

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabelledBy="tx-form-title">
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="tx-form-title"
            eyebrow={isEdit ? 'Editar transacción' : 'Nueva transacción'}
          >
            {isEdit ? (
              <>
                Edita el <span className="gradient-text">movimiento</span>
              </>
            ) : (
              <>
                Agrega un <span className="gradient-text">movimiento</span>
              </>
            )}
          </ModalTitle>
        </ModalHeader>

        {/* Error banner pinned just under the header so the user always
            sees what failed, even if they're scrolled to the bottom of
            the form. */}
        {error && (
          <AlertBanner tone="danger" className="mx-6 mt-3">
            {error}
          </AlertBanner>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Type segmented — Gasto / Ingreso / Transferencia.
              When creating: all three tabs.
              When editing a regular txn: only Gasto/Ingreso (can't morph
              into a transfer in place — would need to spawn a paired leg).
              When editing a transfer: only the Transferencia label so the
              user can change accounts/amount/date/memo but not switch
              type. */}
          <div
            className={`grid gap-2 p-1 bg-[var(--bg)] rounded-xl ${
              isEdit
                ? isTransfer
                  ? 'grid-cols-1'
                  : 'grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {(!isEdit || !isTransfer) && (
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2.5 rounded-lg text-meta sm:text-body-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  type === 'expense'
                    ? 'bg-[var(--coral)]/15 text-[var(--coral-text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <ArrowDownRight size={14} strokeWidth={2.2} />
                Gasto
              </button>
            )}
            {(!isEdit || !isTransfer) && (
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2.5 rounded-lg text-meta sm:text-body-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  type === 'income'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <ArrowUpRight size={14} strokeWidth={2.2} />
                Ingreso
              </button>
            )}
            {(!isEdit || isTransfer) && (
              <button
                type="button"
                onClick={() => !isEdit && setType('transfer')}
                disabled={isEdit && isTransfer}
                className={`py-2.5 rounded-lg text-meta sm:text-body-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                  isTransfer
                    ? 'bg-[var(--info)]/15 text-[var(--info-text)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <ArrowLeftRight size={14} strokeWidth={2.2} />
                Transferencia interna
              </button>
            )}
          </div>

          {/* Receipt camera at the TOP so it's the first thing the user
              sees — avoids the "scroll to find" pattern. Skipped for
              transfers since those don't have a physical receipt. */}
          {!isTransfer && (
            <ReceiptCapture
              initialUrl={initial?.receiptUrl ?? null}
              initialPath={initial?.receiptPath ?? null}
              onChange={(next) => setReceipt(next)}
              onParsed={(parsed) => {
                // Only fill fields the user hasn't touched yet, so a
                // re-scan never destroys typed input. Use typeof guard
                // so a missing field (undefined) doesn't slip through
                // a `!== null` check and clobber state.
                if (
                  typeof parsed.amount === 'number' &&
                  (amount === null || amount === 0)
                ) {
                  setAmount(parsed.amount)
                }
                if (parsed.date && date === todayLocal()) {
                  setDate(parsed.date)
                }
                if (parsed.payee && payeeName.trim() === '') {
                  setPayeeName(parsed.payee)
                }
              }}
            />
          )}

          <FormField label="Monto">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
          </FormField>

          <FormField label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="w-full !text-[16px] sm:!text-body !py-3.5 sm:!py-3 !px-4 !rounded-xl"
            />
          </FormField>

          <FormField label={isTransfer ? 'Cuenta origen' : 'Cuenta'}>
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
          </FormField>

          {isTransfer && (
            <FormField label="Cuenta destino">
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
            </FormField>
          )}

          {!isTransfer && (
          <FormField label={type === 'income' ? 'Recibido de' : 'Pagado a'}>
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
              className="w-full !text-[16px] sm:!text-body !py-3.5 sm:!py-3 !px-4 !rounded-xl"
            />
          </FormField>
          )}

          {/* Categoría + split: ocultos solo cuando el modal abre desde
              el FAB (compactMobile=true). En el flujo normal de
              /movimientos siempre se ven, también en móvil.
              Para transferencias internas: la categoría se guarda
              solo en la pierna SOURCE (el lado que sale), funciona
              como un tag — útil para pagos de tarjeta o moves a
              ahorro etiquetados. Sin botón de split: dividir una
              transferencia no tiene semántica clara. */}
          <div className={compactMobile ? 'hidden lg:block' : ''}>
          {isTransfer ? (
            <FormField label="Categoría" hint="opcional">
              <NativeSelect
                value={categoryId}
                onChange={(v) => setCategoryId(v)}
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
            </FormField>
          ) : !splitMode ? (
            <FormField
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
                <p className="text-eyebrow text-[var(--brand-text)] mt-1.5 leading-relaxed">
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
                className="mt-2 inline-flex items-center gap-1.5 text-meta font-medium text-[var(--text2)] hover:text-[var(--brand-text)] transition-colors"
              >
                <Split size={12} strokeWidth={2.2} />
                Dividir en varias categorías
              </button>
            </FormField>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-meta text-[var(--text2)] font-medium inline-flex items-center gap-1.5">
                  <Split size={12} strokeWidth={2.2} />
                  Split en {splits.length} categorías
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode(false)
                    setSplits([newSplit(), newSplit()])
                  }}
                  className="text-eyebrow text-[var(--muted)] hover:text-[var(--text)] transition-colors"
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
                    <IconButton
                      tone="danger"
                      onClick={() => removeSplitRow(i)}
                      disabled={splits.length <= 2}
                      aria-label="Quitar fila"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </IconButton>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addSplitRow}
                    className="inline-flex items-center gap-1.5 text-meta font-medium text-[var(--text2)] hover:text-[var(--brand-text)] transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.4} />
                    Añadir categoría
                  </button>
                  {amount !== null && amount > 0 && (
                    <button
                      type="button"
                      onClick={equalizeSplits}
                      className="inline-flex items-center gap-1.5 text-meta font-medium text-[var(--text2)] hover:text-[var(--brand-text)] transition-colors"
                      title="Distribuir el monto en partes iguales"
                    >
                      Igualar
                    </button>
                  )}
                  {amount !== null && amount > 0 && splits.length === 2 && (
                    <div className="inline-flex items-center gap-1 text-tiny uppercase tracking-[0.12em] text-[var(--muted2)]">
                      <button
                        type="button"
                        onClick={() => distributeByPercentages([50, 50])}
                        className="hover:text-[var(--brand-text)] transition-colors"
                      >
                        50/50
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => distributeByPercentages([60, 40])}
                        className="hover:text-[var(--brand-text)] transition-colors"
                      >
                        60/40
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => distributeByPercentages([70, 30])}
                        className="hover:text-[var(--brand-text)] transition-colors"
                      >
                        70/30
                      </button>
                    </div>
                  )}
                </div>
                {amount !== null && amount > 0 && (
                  <div className="text-eyebrow tabular-nums num">
                    {splitsBalanced ? (
                      <span className="text-[var(--brand-text)] font-semibold">
                        Cuadrado · ${splitsSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : splitsRemainder > 0 ? (
                      <button
                        type="button"
                        onClick={distributeRemainder}
                        className="text-[var(--coral-text)] font-semibold hover:underline"
                        title="Asignar el resto a la última fila"
                      >
                        Falta ${splitsRemainder.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </button>
                    ) : (
                      <span className="text-[var(--coral-text)] font-semibold">
                        Sobra ${Math.abs(splitsRemainder).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          <div className={compactMobile ? 'hidden lg:block' : ''}>
            <FormField label="Memo" hint="opcional">
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Notas adicionales..."
                maxLength={200}
                rows={2}
                className="w-full !text-[16px] sm:!text-body !py-3 sm:!py-2.5 !px-4 !rounded-xl resize-none"
              />
            </FormField>
          </div>
        </div>

        {!valid && missingFields.length > 0 && (
          <div className="px-6 pb-2 text-eyebrow text-[var(--muted)] leading-snug">
            Falta: <span className="text-[var(--text2)]">{missingFields.join(' · ')}</span>
          </div>
        )}

        <ModalFooter className="!bg-[var(--s1)] sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-12 sm:h-10 px-4 text-body sm:text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] rounded-xl sm:rounded-lg transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || pending}
            className="h-12 sm:h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body sm:text-body-sm rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <Spinner />
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Agregar'
            )}
          </button>
        </ModalFooter>
    </Modal>
  )
}

