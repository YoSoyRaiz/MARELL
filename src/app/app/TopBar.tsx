'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, ArrowRight } from 'lucide-react'
import { AnimatedNumber } from './plan/AnimatedNumber'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useMobileNav } from './MobileNavProvider'
import { useFormatMoney } from './CurrencyProvider'

interface TopBarProps {
  displayName: string | null
  currency: string
}

export function TopBar({ displayName }: TopBarProps) {
  const ctx = useReadyToAssign()
  const readyToAssign = ctx?.readyToAssign ?? 0
  const { toggle: toggleDrawer } = useMobileNav()
  const fmtMoney = useFormatMoney()
  const router = useRouter()
  const [query, setQuery] = useState('')

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
        {/* Hamburger (mobile) + greeting */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label="Abrir menú"
            className="lg:hidden w-10 h-10 -ml-1 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors shrink-0"
          >
            <Menu size={18} strokeWidth={2.2} />
          </button>

          <div className="min-w-0">
            <div className="text-[16px] sm:text-[20px] md:text-[24px] font-bold leading-tight tracking-tight text-[var(--text)] truncate">
              Hola, {firstName ?? 'amigo'} <span aria-hidden>👋</span>
            </div>
            <div className="hidden sm:block text-[12px] text-[var(--muted)] mt-0.5">
              Listo para asignar
            </div>
          </div>
        </div>

        {/* Right cluster: pill + search + bell */}
        <div className="flex items-center gap-3 md:gap-[30px] shrink-0">
          {/* Pill with Asignar button inside */}
          <div
            className={`rounded-2xl border-2 px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-2 md:gap-3 shrink-0 transition-colors ${
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
            <Link
              href="/app/plan"
              className="h-9 md:h-10 px-3 md:px-4 gradient-bg text-[#0B0B0C] font-semibold text-[12px] md:text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-1 md:gap-1.5 transition-[filter] shrink-0"
              aria-label="Asignar"
            >
              <span className="hidden sm:inline">Asignar</span>
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
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
      </div>
    </header>
  )
}
