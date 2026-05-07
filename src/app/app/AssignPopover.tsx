'use client'

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  RotateCcw,
  Calendar,
  Receipt,
} from 'lucide-react'
import {
  fetchAssignContext,
  quickAssign,
  applyAutoAssign,
  type AssignContextCategory,
  type AutoTemplate,
} from './plan/actions'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useFormatMoney } from './CurrencyProvider'

interface AssignPopoverProps {
  open: boolean
  onClose: () => void
  /** Anchor for positioning — the popover floats below the trigger. */
  anchorRef: React.RefObject<HTMLElement | null>
}

type Tab = 'manual' | 'auto'

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

  const [tab, setTab] = useState<Tab>('manual')
  // Quick-assign always sums to the existing assignment. The
  // "replace" path was confusing in user testing, so we removed the
  // toggle; users who need an exact value edit the cell in /app/plan.
  const mode = 'add' as const
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

  // Focus the amount input when the popover opens — desktop only. On
  // mobile we skip auto-focus so the on-screen keyboard doesn't pop up
  // and cover half the sheet; the user taps the field when they're
  // ready to type.
  useEffect(() => {
    if (!open) return
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (!isDesktop) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
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

  // Lock body scroll on mobile while the sheet is open so the page
  // underneath doesn't peek through when the keyboard pushes content.
  useEffect(() => {
    if (!open) return
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    if (!isMobile) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

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
        `${selectedCategory.name}: ${fmtMoney(newAssigned)} asignado (+${fmtMoney(amount)})`,
      )
      setAmountText('')
      router.refresh()
    })
  }

  // On mobile we portal to <body> so the sheet escapes the TopBar's
  // sticky stacking context and the iOS keyboard can't shove the page
  // underneath into view above it. On desktop we keep the popover
  // anchored to the trigger via `lg:absolute`.
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 1023px)').matches

  const node = (
    <>
      {/* Backdrop only on mobile — desktop uses click-outside on the
          popover itself. */}
      <div
        className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] animate-step"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Asignar dinero rápido"
        className={[
          // Mobile: full-width bottom sheet that respects safe-area
          // and clears the MobileTabBar.
          'fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]',
          // Desktop: anchored popover under the topbar pill.
          'lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[400px] lg:max-h-[80vh] lg:rounded-2xl lg:pb-0',
          // Common.
          'overflow-y-auto border border-[var(--border2)] bg-[var(--s1)] shadow-[0_-24px_64px_rgba(0,0,0,0.6)] lg:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step z-[100]',
        ].join(' ')}
      >
        {/* Drag handle on mobile to signal "swipe down to close" — purely
            visual; tap anywhere outside also closes. */}
        <div className="lg:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/[0.15]" />
        </div>
        <header className="px-5 pt-3 pb-3 border-b border-[var(--border)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Asignar dinero
          </div>
          <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">
            Manda un monto a una categoría sin abrir el plan completo.
          </p>
        </header>

      {/* Tab switcher */}
      {ctx !== null && (
        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] rounded-xl">
            <button
              type="button"
              onClick={() => setTab('manual')}
              className={`py-1.5 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                tab === 'manual'
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setTab('auto')}
              className={`py-1.5 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                tab === 'auto'
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Zap size={12} strokeWidth={2.4} />
              Auto
            </button>
          </div>
        </div>
      )}

      {loading && !ctx ? (
        <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
          Cargando categorías…
        </div>
      ) : ctx === null ? (
        <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
          No tienes presupuesto activo.
        </div>
      ) : tab === 'auto' ? (
        <AutoTabContent
          budgetId={ctx.budgetId}
          month={ctx.month}
          onError={setError}
          onSuccess={(message, totalDelta) => {
            setOkMessage(message)
            if (totalDelta !== 0) rta?.adjust(-totalDelta)
            // Refresh categories cache so the manual tab reflects new
            // totals immediately.
            fetchAssignContext().then((r) => {
              if (r.budgetId) {
                setCtx({ budgetId: r.budgetId, month: r.month, categories: r.categories })
              }
            })
            router.refresh()
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
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
              className="w-full mt-1 !text-[28px] sm:!text-[24px] !font-bold !py-4 !px-4 !rounded-xl tabular-nums num"
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
              className="w-full mt-1 !text-[15px] !py-3.5 !px-4 !rounded-xl appearance-none cursor-pointer"
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

          {/* Submit — always sums to the existing assignment. To set
              an exact value the user goes to /app/plan and edits the
              cell directly. Removing the Sumar/Reemplazar toggle
              eliminated a confusing decision the testing users kept
              tripping on. */}
          <button
            type="submit"
            disabled={!selectedCategory || amount <= 0}
            className="w-full h-12 sm:h-11 gradient-bg text-[#0B0B0C] font-semibold text-[15px] sm:text-[14px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center justify-center gap-2 transition-[filter] disabled:opacity-40 disabled:pointer-events-none"
          >
            Asignar
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>

        </form>
      )}

      {/* Shared status messages (manual + auto tabs both write here). */}
      {(okMessage || error) && (
        <div className="px-5 pb-4 space-y-2">
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
        </div>
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
    </>
  )

  if (isMobile && typeof document !== 'undefined') {
    return createPortal(node, document.body)
  }
  return node
}

interface AutoTabContentProps {
  budgetId: string
  month: string
  onError: (msg: string | null) => void
  onSuccess: (message: string, totalDelta: number) => void
}

interface TemplateOption {
  template: AutoTemplate
  label: string
  description: string
  icon: typeof Calendar
  successLabel: string
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    template: 'assigned_last_month',
    label: 'Asignar como mes pasado',
    description: 'Copia lo que asignaste a cada categoría el mes anterior.',
    icon: Calendar,
    successLabel: 'Asignaciones del mes pasado aplicadas',
  },
  {
    template: 'spent_last_month',
    label: 'Lo que gastaste el mes pasado',
    description: 'Asigna a cada categoría lo que realmente gastaste en ella.',
    icon: Receipt,
    successLabel: 'Gasto del mes pasado replicado',
  },
  {
    template: 'reset_assigned',
    label: 'Reiniciar este mes',
    description: 'Vuelve todas las asignaciones de este mes a cero.',
    icon: RotateCcw,
    successLabel: 'Asignaciones reiniciadas',
  },
]

function AutoTabContent({ budgetId, month, onError, onSuccess }: AutoTabContentProps) {
  const [pendingTemplate, setPendingTemplate] = useState<AutoTemplate | null>(null)

  const handleClick = async (option: TemplateOption) => {
    onError(null)
    setPendingTemplate(option.template)
    const r = await applyAutoAssign(budgetId, month, option.template)
    setPendingTemplate(null)
    if (r.error) {
      onError(r.error)
      return
    }
    const changed = r.changedCount ?? 0
    if (changed === 0) {
      onSuccess('Sin cambios — todo ya estaba en su lugar.', 0)
      return
    }
    const message = `${option.successLabel} · ${changed} ${changed === 1 ? 'categoría' : 'categorías'}`
    onSuccess(message, r.totalDelta ?? 0)
  }

  return (
    <div className="px-5 py-4 space-y-2">
      {TEMPLATE_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isPending = pendingTemplate === opt.template
        const disabled = pendingTemplate !== null && !isPending
        return (
          <button
            key={opt.template}
            type="button"
            onClick={() => handleClick(opt)}
            disabled={disabled}
            className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-white/[0.02] px-3.5 py-3 flex items-start gap-3 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] text-[var(--brand-2)] flex items-center justify-center shrink-0">
              <Icon size={14} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--text)] leading-tight">
                {opt.label}
              </div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                {isPending ? 'Aplicando…' : opt.description}
              </div>
            </div>
            <ArrowRight
              size={14}
              strokeWidth={2.4}
              className="text-[var(--muted2)] shrink-0 mt-1"
            />
          </button>
        )
      })}
    </div>
  )
}
