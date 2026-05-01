'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  Repeat,
  Target,
  Calculator,
  Users,
  LifeBuoy,
  LogOut,
  ChevronUp,
  RotateCcw,
  CircleUser,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { logout } from '@/app/(auth)/actions'
import { resetOnboarding } from '@/app/onboarding/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useMobileNav } from './MobileNavProvider'

const NAV = [
  { id: 'resumen', label: 'Resumen', href: '/app', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', href: '/app/plan', icon: Sparkles },
  { id: 'cuentas', label: 'Cuentas', href: '/app/cuentas', icon: Wallet },
  { id: 'analisis', label: 'Análisis', href: '/app/analisis', icon: BarChart3 },
  { id: 'transacciones', label: 'Transacciones', href: '/app/transacciones', icon: ArrowLeftRight },
  { id: 'programadas', label: 'Programadas', href: '/app/programadas', icon: Repeat },
  { id: 'metas', label: 'Metas', href: '/app/metas', icon: Target },
  { id: 'familia', label: 'Familia', href: '/app/familia', icon: Users },
  { id: 'herramientas', label: 'Cálculos', href: '/app/herramientas', icon: Calculator },
] as const

interface SidebarProps {
  displayName: string | null
  email: string | null
  plan: string
  trialEndsAt: string | null
  isAdmin?: boolean
}

export function Sidebar({
  displayName,
  email,
  plan,
  trialEndsAt,
  isAdmin = false,
}: SidebarProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const confirm = useConfirm()
  const { open: drawerOpen, close: closeDrawer } = useMobileNav()
  const [menuOpen, setMenuOpen] = useState(false)
  const [, startReset] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const initials = (displayName ?? '?').trim().split(/\s+/).map((s) => s[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'

  // Close popover on outside click + Escape
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const trialDaysLeft = (() => {
    if (plan !== 'trial' || !trialEndsAt) return null
    const end = new Date(trialEndsAt).getTime()
    const now = Date.now()
    const days = Math.ceil((end - now) / 86400000)
    return Number.isFinite(days) ? days : null
  })()

  const handleReset = async () => {
    setMenuOpen(false)
    const ok = await confirm({
      title: '¿Rehacer el onboarding?',
      description:
        'Esto borra tu plan actual (categorías, cuentas, asignaciones) y te lleva de vuelta al wizard. No se puede deshacer.',
      confirmLabel: 'Borrar y rehacer',
      tone: 'danger',
    })
    if (!ok) return
    startReset(async () => {
      const r = await resetOnboarding()
      if (!r || !('error' in r) || !r.error) {
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[var(--border)] bg-[var(--s1)]/95 backdrop-blur-md flex flex-col transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[240px] lg:translate-x-0 lg:bg-[var(--s1)]/60 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-hidden={!drawerOpen ? undefined : false}>
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

      {/* Premium upsell — only while on trial */}
      {plan === 'trial' && (
        <div className="mx-3 mb-3 mt-4 p-4 rounded-2xl bg-[var(--s2)] border border-[var(--border2)] gradient-border space-y-3">
          <div className="text-[13px] font-semibold leading-snug">
            Desbloquea tu <span className="gradient-text">potencial</span> financiero.
          </div>
          <Link
            href="/pricing"
            className="w-full h-9 gradient-bg text-[#0B0B0C] font-semibold text-[12px] rounded-lg glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] inline-flex items-center justify-center"
          >
            Mejorar a Premium
          </Link>
        </div>
      )}

      {/* Help — opens default mail client */}
      <div className="px-5 mb-3">
        <a
          href="mailto:soporte@marell.app?subject=Ayuda%20MARELL"
          className="flex items-center gap-2 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <LifeBuoy size={14} strokeWidth={2} />
          Ayuda y soporte
        </a>
      </div>

      {/* User profile menu */}
      <div ref={menuRef} className="relative border-t border-[var(--border)] px-3 py-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
            menuOpen ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]'
          }`}
        >
          <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-[13px] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-medium truncate">{displayName ?? 'Usuario'}</div>
            <div className="text-[11px] text-[var(--muted)] capitalize truncate">
              {plan}
              {trialDaysLeft !== null && trialDaysLeft >= 0 && (
                <span className="ml-1 normal-case">
                  · {trialDaysLeft}d restantes
                </span>
              )}
            </div>
          </div>
          <ChevronUp
            size={14}
            strokeWidth={2.2}
            className={`text-[var(--muted)] shrink-0 transition-transform ${
              menuOpen ? '' : 'rotate-180'
            }`}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-[calc(100%-4px)] left-3 right-3 mb-2 rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden animate-step"
          >
            {/* Identity */}
            <div className="px-4 py-3.5 border-b border-[var(--border)] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-[14px] shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {displayName ?? 'Usuario'}
                  </div>
                  {email && (
                    <div className="text-[11px] text-[var(--muted)] truncate">{email}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-[var(--border)] text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text2)]">
                  {plan}
                </span>
                {trialDaysLeft !== null && (
                  <span
                    className={`text-[11px] ${
                      trialDaysLeft <= 3 ? 'text-[var(--coral)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {trialDaysLeft >= 0
                      ? `${trialDaysLeft} ${trialDaysLeft === 1 ? 'día' : 'días'} restantes`
                      : 'Trial vencido'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="py-1">
              <Link
                href="/app/ajustes"
                onClick={() => setMenuOpen(false)}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text)] hover:bg-white/[0.04] transition-colors"
              >
                <CircleUser size={14} strokeWidth={2} className="text-[var(--text2)]" />
                Ajustes de cuenta
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text)] hover:bg-white/[0.04] transition-colors"
                >
                  <ShieldCheck size={14} strokeWidth={2} className="text-[var(--brand-2)]" />
                  Panel de admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleReset}
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text)] hover:bg-white/[0.04] transition-colors text-left"
              >
                <RotateCcw size={14} strokeWidth={2} className="text-[var(--text2)]" />
                Rehacer onboarding
              </button>
            </div>

            <form action={logout} className="border-t border-[var(--border)]">
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--coral)] hover:bg-[rgba(255,122,89,0.08)] transition-colors"
              >
                <LogOut size={14} strokeWidth={2} />
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
      </aside>
    </>
  )
}
