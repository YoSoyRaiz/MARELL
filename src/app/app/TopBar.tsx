'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, ArrowRight, ChevronDown } from 'lucide-react'
import { AnimatedNumber } from './plan/AnimatedNumber'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useMobileNav } from './MobileNavProvider'
import { useFormatMoney } from './CurrencyProvider'
import { AssignPopover } from './AssignPopover'
import { SHORTCUT_EVENTS } from './KeyboardShortcuts'
import { NotificationBell, type NotificationItem } from './NotificationBell'
import { markNotificationsSeen } from './ajustes/actions'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface TopBarProps {
  displayName: string | null
  currency: string
  notifications?: NotificationItem[]
  notificationsLastSeen?: string | null
}

export function TopBar({
  displayName,
  notifications = [],
  notificationsLastSeen = null,
}: TopBarProps) {
  const ctx = useReadyToAssign()
  const readyToAssign = ctx?.readyToAssign ?? 0
  const { toggle: toggleDrawer } = useMobileNav()
  const fmtMoney = useFormatMoney()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const assignTriggerRef = useRef<HTMLDivElement>(null)

  // Listen for the global "a" keyboard shortcut to open the popover.
  useEffect(() => {
    const onAssignKey = () => setAssignOpen((v) => !v)
    window.addEventListener(SHORTCUT_EVENTS.assignMoney, onAssignKey)
    return () => window.removeEventListener(SHORTCUT_EVENTS.assignMoney, onAssignKey)
  }, [])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/app/transacciones?q=${encodeURIComponent(q)}` : '/app/transacciones')
  }
  const firstName = displayName?.trim().split(/\s+/)[0]
  const isPositive = readyToAssign > 0.005
  const isNegative = readyToAssign < -0.005

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md px-4 py-3 sm:px-6 md:px-8 md:py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3 md:gap-6">
        {/* Left: hamburger (mobile) + greeting (desktop) */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label="Abrir menú"
            className="lg:hidden w-10 h-10 -ml-1 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors shrink-0"
          >
            <Menu size={18} strokeWidth={2.2} />
          </button>

          <div className="hidden lg:block min-w-0">
            <div className="text-[16px] sm:text-[20px] md:text-[24px] font-bold leading-tight tracking-tight text-[var(--text)] truncate">
              Hola, {firstName ?? 'amigo'} <span aria-hidden>👋</span>
            </div>
            <div className="hidden sm:block text-[12px] text-[var(--muted)] mt-0.5">
              Listo para asignar
            </div>
          </div>
        </div>

        {/* Cluster: pill + bell. Centered on mobile (since the greeting
            is hidden — the bottom tab bar already shows the user name),
            right-aligned on desktop. */}
        <div className="flex-1 flex items-center justify-center lg:justify-end lg:flex-initial gap-2 md:gap-3 min-w-0">
          <ThemeToggle />
          <NotificationBell
            notifications={notifications}
            lastSeenAt={notificationsLastSeen}
            onMarkSeen={async () => {
              await markNotificationsSeen()
            }}
          />
          {/* Pill with Asignar button inside */}
          <div ref={assignTriggerRef} className="relative shrink-0">
            <div
              className={`rounded-2xl border-2 px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-2 md:gap-3 transition-colors ${
                isNegative
                  ? 'border-[var(--coral)]/40 bg-[rgba(255,122,89,0.04)]'
                  : 'border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)]'
              }`}
            >
              <div className="leading-none">
                <div
                  className={`text-[9px] md:text-[10px] uppercase tracking-[0.18em] font-semibold ${
                    isNegative ? 'text-[var(--coral)]' : 'text-[var(--brand-2)]'
                  }`}
                >
                  Por asignar
                </div>
                <AnimatedNumber
                  value={readyToAssign}
                  format={fmtMoney}
                  className={`text-[16px] sm:text-[20px] md:text-[28px] font-bold tabular-nums num leading-none mt-1 block ${
                    isNegative
                      ? 'text-[var(--coral)]'
                      : isPositive
                        ? 'gradient-text'
                        : 'text-[var(--text2)]'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => setAssignOpen((v) => !v)}
                aria-expanded={assignOpen}
                aria-haspopup="dialog"
                aria-label="Abrir popover para asignar dinero"
                className="h-9 md:h-10 px-3 md:px-4 gradient-bg text-[#0B0B0C] font-semibold text-[12px] md:text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-1 md:gap-1.5 transition-[filter]"
              >
                <span className="hidden sm:inline">Asignar</span>
                <ChevronDown
                  size={14}
                  strokeWidth={2.4}
                  className={`transition-transform ${assignOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            <AssignPopover
              open={assignOpen}
              onClose={() => setAssignOpen(false)}
              anchorRef={assignTriggerRef}
            />
          </div>

          {/* Search — desktop-only; submits to /app/transacciones?q=... */}
          <form
            onSubmit={handleSearch}
            className="hidden md:block relative w-[260px] xl:w-[340px]"
            role="search"
          >
            <Search
              size={14}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar transacciones..."
              aria-label="Buscar transacciones"
              className="w-full !h-11 !pl-10 !pr-3 !text-[13px] !rounded-xl"
            />
          </form>
        </div>

        {/* Spacer on mobile only — mirrors the hamburger width so the
            centered cluster stays optically centered. */}
        <div className="lg:hidden w-9 shrink-0" aria-hidden />
      </div>
    </header>
  )
}
