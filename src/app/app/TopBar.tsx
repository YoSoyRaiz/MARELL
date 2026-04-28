'use client'

import Link from 'next/link'
import { Bell, Search, Sparkles } from 'lucide-react'

interface TopBarProps {
  displayName: string | null
  readyToAssign: number
  currency: string
}

const fmtMoney = (n: number, currency: string) => {
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${currency === 'USD' ? '$' : '$'}${formatted}`
}

export function TopBar({ displayName, readyToAssign, currency }: TopBarProps) {
  const firstName = displayName?.trim().split(/\s+/)[0]
  const isPositive = readyToAssign > 0.005

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md px-8 py-5 flex items-center gap-6 sticky top-0 z-10">
      {/* Greeting */}
      <div className="min-w-0">
        <div className="text-[18px] font-bold leading-tight tracking-tight">
          Hola, {firstName ?? 'amigo'} <span aria-hidden>👋</span>
        </div>
        <div className="text-[12px] text-[var(--muted)] mt-1 flex items-center gap-1.5">
          <span>Asignar disponible</span>
          <span
            className={`num font-semibold tabular-nums ${
              isPositive ? 'gradient-text' : 'text-[var(--text2)]'
            }`}
          >
            {fmtMoney(readyToAssign, currency)}
          </span>
          <span className="text-[var(--muted2)]">·</span>
          <span>Listo para asignar</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search size={14} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar transacciones, categorías, cuentas..."
            className="w-full !h-10 !pl-10 !pr-3 !text-[13px] !rounded-xl"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          aria-label="Notificaciones"
          className="w-10 h-10 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
        >
          <Bell size={16} strokeWidth={2} />
        </button>
        <Link
          href="/app/plan"
          className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter]"
        >
          <Sparkles size={14} strokeWidth={2.4} />
          Asignar dinero
        </Link>
      </div>
    </header>
  )
}
