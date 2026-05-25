'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import { ArrowRight, X, ArrowLeftRight, AlertCircle } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { moveMoneyBetweenCategories } from './actions'
import { useReadyToAssign } from '../ReadyToAssignProvider'
import { useFormatMoney } from '../CurrencyProvider'
import { Button } from '@/components/ui/Button'
import type { PlanGroup } from './PlanView'

interface MoveMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  budgetId: string
  month: string
  fromCategoryId: string
  groups: PlanGroup[]
  /** Live (post-override) available for the source row at open time. */
  fromAvailable: number
  /**
   * Called after a successful move so the parent can patch its overrides
   * and refresh server data.
   */
  onMoved: (
    fromCategoryId: string,
    toCategoryId: string,
    fromAssigned: number,
    toAssigned: number,
  ) => void
}

function formatTyping(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (cleaned === '') return ''
  const [intPart, ...rest] = cleaned.split('.')
  const decimals = rest.length > 0 ? `.${rest.join('').slice(0, 2)}` : ''
  const intFormatted = intPart === '' ? '' : Number(intPart).toLocaleString('en-US')
  return `${intFormatted}${decimals}`
}

function parseAmount(text: string): number {
  const cleaned = text.replace(/,/g, '').trim()
  if (!cleaned) return 0
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function MoveMoneyModal({
  isOpen,
  onClose,
  budgetId,
  month,
  fromCategoryId,
  groups,
  fromAvailable,
  onMoved,
}: MoveMoneyModalProps) {
  const fmtMoney = useFormatMoney()
  const rta = useReadyToAssign()
  const [, startMutate] = useTransition()
  const [toId, setToId] = useState('')
  const [amountText, setAmountText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sourceCategory = useMemo(() => {
    for (const g of groups) {
      const c = g.categories.find((x) => x.id === fromCategoryId)
      if (c) return { ...c, groupName: g.name }
    }
    return null
  }, [groups, fromCategoryId])

  // Reset on every open + focus the amount input.
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setAmountText('')
    setToId('')
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [isOpen, fromCategoryId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || !sourceCategory) return null

  const amount = parseAmount(amountText)
  const canSubmit = amount > 0 && toId !== '' && toId !== fromCategoryId

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    startMutate(async () => {
      const r = await moveMoneyBetweenCategories(
        budgetId,
        fromCategoryId,
        toId,
        month,
        amount,
      )
      if ('error' in r) {
        setError(r.error)
        return
      }
      // RtA delta is zero by construction, but call adjust(0) to be explicit.
      rta?.adjust(0)
      onMoved(fromCategoryId, toId, r.fromAssigned, r.toAssigned)
      onClose()
    })
  }

  const SourceIcon = iconForCategoryName(sourceCategory.name)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-money-title"
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] inline-flex items-center gap-2">
              <ArrowLeftRight size={12} strokeWidth={2.4} />
              Mover dinero
            </div>
            <h2
              id="move-money-title"
              className="text-[18px] font-bold mt-1 leading-tight tracking-tight"
            >
              De <span className="gradient-text">{sourceCategory.name}</span> a otra categoría
            </h2>
            <div className="text-[12px] text-[var(--muted)] mt-1 num tabular-nums">
              Disponible aquí: <span className="text-[var(--text2)]">{fmtMoney(fromAvailable)}</span>
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

        <div className="px-6 py-4 space-y-4">
          {/* Source preview */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0">
              <SourceIcon size={14} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-[var(--text)] truncate">{sourceCategory.name}</div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                {sourceCategory.groupName}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="mm-amount"
              className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
            >
              Monto
            </label>
            <input
              ref={inputRef}
              id="mm-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={(e) => setAmountText(formatTyping(e.target.value))}
              placeholder="0.00"
              className="w-full mt-1 !text-[18px] !font-bold !py-3 !px-4 !rounded-xl tabular-nums num"
            />
            {fromAvailable > 0.005 && (
              <button
                type="button"
                onClick={() => setAmountText(formatTyping(String(fromAvailable.toFixed(2))))}
                className="mt-1.5 text-[11px] text-[var(--brand-text)] font-medium hover:underline underline-offset-4 num tabular-nums"
              >
                Mover todo: {fmtMoney(fromAvailable)}
              </button>
            )}
          </div>

          {/* Destination */}
          <div>
            <label
              htmlFor="mm-to"
              className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
            >
              Categoría destino
            </label>
            <select
              id="mm-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full mt-1 !text-[14px] !py-3 !px-4 !rounded-xl appearance-none cursor-pointer"
            >
              <option value="">Selecciona…</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories
                    .filter((c) => c.id !== fromCategoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
              <AlertCircle
                size={14}
                strokeWidth={2.2}
                className="text-[var(--coral-text)] shrink-0 mt-0.5"
              />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--overlay-1)]">
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="gradient"
            size="tight"
            disabled={!canSubmit}
            iconRight={<ArrowRight size={14} strokeWidth={2.4} />}
          >
            Mover
          </Button>
        </footer>
      </form>
    </div>
  )
}
