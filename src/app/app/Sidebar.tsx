'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  Repeat,
  Target,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { logout } from '@/app/(auth)/actions'

const NAV = [
  { id: 'resumen', label: 'Resumen', href: '/app', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', href: '/app/plan', icon: Sparkles },
  { id: 'cuentas', label: 'Cuentas', href: '/app/cuentas', icon: Wallet },
  { id: 'analisis', label: 'Análisis', href: '/app/analisis', icon: BarChart3 },
  { id: 'transacciones', label: 'Transacciones', href: '/app/transacciones', icon: ArrowLeftRight },
  { id: 'programadas', label: 'Programadas', href: '/app/programadas', icon: Repeat },
  { id: 'metas', label: 'Metas', href: '/app/metas', icon: Target },
] as const

export function Sidebar({ displayName, plan }: { displayName: string | null; plan: string }) {
  const pathname = usePathname() ?? ''
  const initials = (displayName ?? '?').trim().split(/\s+/).map((s) => s[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'

  return (
    <aside className="w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--s1)]/60 backdrop-blur-md flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-[50px]">
        <Logo height={50} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item, idx) => {
          const isActive =
            item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${
                isActive
                  ? 'gradient-bg text-[#0B0B0C] font-semibold shadow-[0_4px_16px_rgba(61,220,151,.18)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`text-[11px] tabular-nums shrink-0 ${
                  isActive ? 'text-[#0B0B0C]/60' : 'text-[var(--muted2)]'
                }`}
              >
                {idx + 1}.
              </span>
              <Icon size={16} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Premium upsell */}
      {plan === 'trial' && (
        <div className="mx-3 mb-3 mt-4 p-4 rounded-2xl bg-[var(--s2)] border border-[var(--border2)] gradient-border space-y-3">
          <div className="text-[13px] font-semibold leading-snug">
            Desbloquea tu <span className="gradient-text">potencial</span> financiero.
          </div>
          <button
            type="button"
            className="w-full h-9 gradient-bg text-[#0B0B0C] font-semibold text-[12px] rounded-lg glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter]"
          >
            Mejorar a Premium
          </button>
        </div>
      )}

      {/* Help */}
      <div className="px-5 mb-3">
        <Link
          href="#"
          className="flex items-center gap-2 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <LifeBuoy size={14} strokeWidth={2} />
          Ayuda y soporte
        </Link>
      </div>

      {/* User */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-[13px] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{displayName ?? 'Usuario'}</div>
            <div className="text-[11px] text-[var(--muted)] capitalize">{plan}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.04] p-1.5 rounded-md transition-colors"
            >
              <LogOut size={14} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
