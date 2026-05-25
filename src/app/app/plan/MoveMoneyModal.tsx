'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import { ArrowRight, ArrowLeftRight } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { moveMoneyBetweenCategories } from './actions'
import { useReadyToAssign } from '../ReadyToAssignProvider'
import { useFormatMoney } from '../CurrencyProvider'
import { Button } from '@/components/ui/Button'
import { ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
import { IconBadge } from '@/components/ui/IconBadge'
import { AlertBanner } from '@/components/ui/AlertBanner'
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

  if (!sourceCategory) return null

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="move-money-title"
      maxHeight="92vh"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="move-money-title"
            size="compact"
            eyebrow={
              <span className="inline-flex items-center gap-2">
                <ArrowLeftRight size={12} strokeWidth={2.4} />
                Mover dinero
              </span>
            }
            description={
              <span className="num tabular-nums">
                Disponible aquí:{' '}
                <span className="text-[var(--text2)]">
                  {fmtMoney(fromAvailable)}
                </span>
              </span>
            }
          >
            De <span className="gradient-text">{sourceCategory.name}</span> a otra categoría
          </ModalTitle>
        </ModalHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Source preview */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 flex items-center gap-3">
            <IconBadge size="sm">
              <SourceIcon size={14} strokeWidth={2} />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <div className="text-body-sm text-[var(--text)] truncate">{sourceCategory.name}</div>
              <div className="text-eyebrow text-[var(--muted)] truncate">
                {sourceCategory.groupName}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="mm-amount"
              className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
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
              className="w-full mt-1 !text-h3 !font-bold !py-3 !px-4 !rounded-xl tabular-nums num"
            />
            {fromAvailable > 0.005 && (
              <button
                type="button"
                onClick={() => setAmountText(formatTyping(String(fromAvailable.toFixed(2))))}
                className="mt-1.5 text-eyebrow text-[var(--brand-text)] font-medium hover:underline underline-offset-4 num tabular-nums"
              >
                Mover todo: {fmtMoney(fromAvailable)}
              </button>
            )}
          </div>

          {/* Destination */}
          <div>
            <label
              htmlFor="mm-to"
              className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
            >
              Categoría destino
            </label>
            <select
              id="mm-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full mt-1 !text-body !py-3 !px-4 !rounded-xl appearance-none cursor-pointer"
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
            <AlertBanner tone="danger" size="sm">
              {error}
            </AlertBanner>
          )}
        </div>

        <ModalFooter>
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
        </ModalFooter>
      </form>
    </Modal>
  )
}
