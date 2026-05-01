'use client'

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Plus,
  Equal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  fetchAssignContext,
  quickAssign,
  type AssignContextCategory,
} from './plan/actions'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useFormatMoney } from './CurrencyProvider'

interface AssignPopoverProps {
  open: boolean
  onClose: () => void
  /** Anchor for positioning — the popover floats below the trigger. */
  anchorRef: React.RefObject<HTMLElement | null>
}

type Mode = 'add' | 'set'

interface LoadedContext {
  budgetId: string
  month: string
  categories: AssignContextCategory[]
}

// Live formatting while typing: digits + optional one decimal, with
// thousands separator. Empty stays empty. Mirrors InlineMoneyEdit behavior
// minus the leading "+" trick (mode is explicit here).
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

export function AssignPopover({ open, onClose, anchorRef }: AssignPopoverProps) {
  const router = useRouter()
  const rta = useReadyToAssign()
  const fmtMoney = useFormatMoney()
  const [, startMutate] = useTransition()
  const [ctx, setCtx] = useState<LoadedContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('add')
  const [categoryId, setCategoryId] = useState('')
  const [amountText, setAmountText] = useState('')

  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load context the first time we open and reset on close.
  useEffect(() => {
    if (!open) {
      setError(null)
      setOkMessage(null)
      setAmountText('')
      return
    }
    if (ctx) return // already loaded once
    setLoading(true)
    fetchAssignContext()
      .then((r) => {
        if (r.budgetId) {
          setCtx({ budgetId: r.budgetId, month: r.month, categories: r.categories })
          setCategoryId((prev) => prev || r.categories[0]?.id || '')
        }
      })
      .finally(() => setLoading(false))
  }, [open, ctx])

  // Focus the input when the popover opens.
  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => inputRef.current?.focus())
      return () => window.cancelAnimationFrame(id)
    }
  }, [open])

  // Click-outside + Esc.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const grouped = (() => {
    if (!ctx) return [] as { name: string; cats: AssignContextCategory[] }[]
    const map = new Map<string, { name: string; sort: number; cats: AssignContextCategory[] }>()
    for (const c of ctx.categories) {
      const entry = map.get(c.groupId)
      if (entry) entry.cats.push(c)
      else map.set(c.groupId, { name: c.groupName, sort: c.groupSort, cats: [c] })
    }
    return Array.from(map.values())
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({
        name: g.name,
        cats: [...g.cats].sort((a, b) => a.sortOrder - b.sortOrder),
      }))
  })()

  const selectedCategory = ctx?.categories.find((c) => c.id === categoryId) ?? null
  const amount = parseAmount(amountText)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ctx || !selectedCategory || amount <= 0) return
    setError(null)
    setOkMessage(null)
    startMutate(async () => {
      const r = await quickAssign(
        ctx.budgetId,
        selectedCategory.id,
        ctx.month,
        amount,
        mode,
      )
      if (!('success' in r)) {
        setError(r.error)
        return
      }
      const newAssigned = r.assigned
      const delta = r.delta

      // Optimistic ready-to-assign update.
      rta?.adjust(-delta)

      // Update the local categories cache so the next assignment in this
      // session shows the right "actualmente asignado" hint.
      setCtx((prev) =>
        prev
          ? {
              ...prev,
              categories: prev.categories.map((c) =>
                c.id === selectedCategory.id ? { ...c, assigned: newAssigned } : c,
              ),
            }
          : prev,
      )

      setOkMessage(
        `${selectedCategory.name}: ${fmtMoney(newAssigned)} asignado` +
          (mode === 'add' ? ` (+${fmtMoney(amount)})` : ''),
      )
      setAmountText('')
      router.refresh()
    })
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Asignar dinero rápido"
      className="absolute right-0 top-full mt-2 w-[360px] sm:w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step z-40"
    >
      <header className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-2)]">
          Asignar dinero
        </div>
        <p className="text-[12px] text-[var(--muted)] mt-0.5 leading-relaxed">
          Manda un monto a una categoría sin abrir el plan completo.
        </p>
      </header>

      {loading && !ctx ? (
        <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
          Cargando categorías…
        </div>
      ) : ctx === null ? (
        <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
          No tienes presupuesto activo.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`py-2 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'add'
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Plus size={12} strokeWidth={2.4} />
              Sumar al actual
            </button>
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`py-2 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'set'
                  ? 'bg-[var(--info)]/15 text-[var(--info)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Equal size={12} strokeWidth={2.4} />
              Reemplazar
            </button>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="qa-amount"
              className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
            >
              Monto
            </label>
            <input
              ref={inputRef}
              id="qa-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={(e) => setAmountText(formatTyping(e.target.value))}
              placeholder="0.00"
              className="w-full mt-1 !text-[18px] !font-bold !py-3 !px-4 !rounded-xl tabular-nums num"
            />
          </div>

          {/* Category select */}
          <div>
            <label
              htmlFor="qa-cat"
              className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold"
            >
              Categoría
            </label>
            <select
              id="qa-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full mt-1 !text-[14px] !py-3 !px-4 !rounded-xl appearance-none cursor-pointer"
            >
              {grouped.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedCategory && (
              <p className="mt-1.5 text-[11px] text-[var(--muted)] num tabular-nums">
                Actualmente: <span className="text-[var(--text2)]">{fmtMoney(selectedCategory.assigned)}</span>
                {selectedCategory.goalAmount && selectedCategory.goalAmount > 0 ? (
                  <>
                    {' · '}
                    Meta: <span className="text-[var(--text2)]">{fmtMoney(selectedCategory.goalAmount)}</span>
                  </>
                ) : null}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!selectedCategory || amount <= 0}
            className="w-full h-11 gradient-bg text-[#0B0B0C] font-semibold text-[14px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center justify-center gap-2 transition-[filter] disabled:opacity-40 disabled:pointer-events-none"
          >
            {mode === 'add' ? 'Sumar' : 'Reemplazar'}
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>

          {okMessage && (
            <div className="rounded-xl border border-[var(--success)]/40 bg-[rgba(61,220,151,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
              <CheckCircle2
                size={14}
                strokeWidth={2.2}
                className="text-[var(--success)] shrink-0 mt-0.5"
              />
              <span>{okMessage}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
              <AlertCircle
                size={14}
                strokeWidth={2.2}
                className="text-[var(--coral)] shrink-0 mt-0.5"
              />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}

      <footer className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3 text-[12px]">
        <span className="text-[var(--muted)] inline-flex items-center gap-1.5">
          <Sparkles size={12} strokeWidth={2.2} className="text-[var(--brand-2)]" />
          Acción rápida
        </span>
        <Link
          href="/app/plan"
          onClick={onClose}
          className="text-[var(--brand-2)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
        >
          Ver plan completo
          <ArrowRight size={11} strokeWidth={2.4} />
        </Link>
      </footer>
    </div>
  )
}
