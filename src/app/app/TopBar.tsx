'use client'

import Link from 'next/link'
import { Bell, Search, ArrowRight } from 'lucide-react'

interface TopBarProps {
  displayName: string | null
  readyToAssign: number
  currency: string
}

const fmtMoney = (n: number, _currency: string) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (n < -0.005) return `−$${formatted}`
  return `$${formatted}`
}

export function TopBar({ displayName, readyToAssign, currency }: TopBarProps) {
  const firstName = displayName?.trim().split(/\s+/)[0]
  const isPositive = readyToAssign > 0.005
  const isNegative = readyToAssign < -0.005

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md px-8 py-4 flex items-center gap-5 sticky top-0 z-10">
      {/* Greeting (compact, hidden on mobile) */}
      <div className="hidden md:block min-w-0 shrink-0">
        <div className="text-[14px] font-semibold leading-tight text-[var(--text)]">
          Hola, {firstName ?? 'amigo'} <span aria-hidden>👋</span>
        </div>
        <div className="text-[11px] text-[var(--muted)] mt-0.5">Listo para asignar</div>
      </div>

      {/* Por asignar pill (the focal point) */}
      <div
        className={`rounded-2xl border-2 px-4 py-2.5 flex items-center gap-3 shrink-0 transition-colors ${
          isNegative
            ? 'border-[var(--coral)]/40 bg-[rgba(255,122,89,0.04)]'
            : 'border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)]'
        }`}
      >
        <div className="leading-none">
          <div
            className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
              isNegative ? 'text-[var(--coral)]' : 'text-[var(--brand-2)]'
            }`}
          >
            Por asignar
          </div>
          <div
            className={`text-[24px] sm:text-[28px] font-bold tabular-nums num leading-none mt-1 ${
              isNegative ? 'text-[var(--coral)]' : isPositive ? 'gradient-text' : 'text-[var(--text2)]'
            }`}
          >
            {fmtMoney(readyToAssign, currency)}
          </div>
        </div>
        <Link
          href="/app/plan"
          className="h-10 px-4 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-1.5 transition-[filter] shrink-0"
        >
          Asignar
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>

      {/* Search */}
      <div className="flex-1 hidden md:block">
        <div className="relative max-w-md">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="search"
            placeholder="Buscar transacciones, categorías, cuentas..."
            className="w-full !h-11 !pl-10 !pr-3 !text-[13px] !rounded-xl"
          />
        </div>
      </div>

      {/* Bell on far right */}
      <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
        <button
          type="button"
          aria-label="Notificaciones"
          className="w-10 h-10 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
        >
          <Bell size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
