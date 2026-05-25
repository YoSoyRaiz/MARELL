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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { logout } from '@/app/(auth)/actions'
import { resetOnboarding } from '@/app/onboarding/actions'
import { useOnboardingStore } from '@/app/onboarding/wizard/store'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
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

  // ── Collapsed state (desktop only) ──────────────────────────────
  // Persisted en localStorage para que la preferencia sobreviva al
  // refresh. SSR-safe: arranca expanded y se hidrata desde storage
  // dentro de useEffect — evita el hydration mismatch.
  //
  // Sincroniza un CSS variable `--sidebar-w` en :root para que el
  // contenido principal pueda ajustar su margin-left dinámicamente sin
  // pasar la prop a través de React (la sidebar es desktop-fixed, así
  // que el main necesita el offset para no quedar tapado).
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const syncSidebarWidthVar = (isCollapsed: boolean) => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty(
      '--sidebar-w',
      isCollapsed ? '72px' : '240px',
    )
  }

  useEffect(() => {
    let initial = false
    try {
      const saved = window.localStorage.getItem('marell:sidebar-collapsed')
      if (saved === 'true') initial = true
    } catch {
      // localStorage puede no estar disponible (incognito, sandbox).
    }
    setCollapsed(initial)
    syncSidebarWidthVar(initial)
    setHydrated(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('marell:sidebar-collapsed', String(next))
      } catch {
        /* noop */
      }
      syncSidebarWidthVar(next)
      // Cierra el menu de perfil si se colapsa estando abierto —
      // queda fuera de espacio.
      if (next) setMenuOpen(false)
      return next
    })
  }

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
      title: '¿Borrar todo y rehacer el onboarding?',
      description:
        'Esto elimina permanentemente TODOS tus registros: presupuestos, categorías, cuentas, transacciones, metas, programadas, fotos de recibos y el contador mensual de OCR. Quedas como un usuario nuevo. No se puede deshacer.',
      confirmLabel: 'Sí, borrar todo',
      tone: 'danger',
    })
    if (!ok) return
    // Clear the persisted wizard state in this browser so the user
    // lands on step 0 instead of the last step they finished. La
    // limpieza de DB pasa server-side; esto limpia el mirror local.
    useOnboardingStore.getState().reset()
    // Limpia también los flags de "ya viste esto" que dependen del
    // navegador: el FirstMonthGuide del Resumen y los dismiss diarios
    // del TrialBanner. Así el usuario reseteado vuelve a recibir los
    // tips como si fuera nuevo.
    try {
      window.localStorage.removeItem('marell:first-month-guide-dismissed')
      // El trial banner dismiss usa una key con fecha y días restantes
      // — barrer por prefijo es lo más simple/robusto.
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith('marell:trial-banner-dismissed:')) {
          window.localStorage.removeItem(k)
        }
      }
    } catch {
      // Storage puede no estar disponible (incognito, sandbox). No es
      // crítico — el reset del servidor sigue funcionando.
    }
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
        className={`fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />

      {/* En desktop usamos `position: fixed` (en vez de sticky) porque:
            - Garantiza que el sidebar nunca se mueve con el scroll en
              ningún navegador, sin importar el flex layout exterior
            - Evita los gotchas de sticky en flex containers (stretch,
              transform en ancestros, etc.)
          El contenido principal en AppShell se offsetea con
          `lg:ml-[var(--sidebar-w)]` para no quedar tapado. La variable
          CSS la inyecta este componente al montar/togglear. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] border-r border-[var(--border)] bg-[var(--s1)]/95 backdrop-blur-md flex flex-col transition-transform duration-300 ease-out lg:max-w-none lg:translate-x-0 lg:bg-[var(--s1)]/60 lg:transition-[width] lg:duration-300 lg:ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'}`}
        aria-hidden={!drawerOpen ? undefined : false}>
      {/* Logo + collapse toggle — el botón solo aparece en desktop
          (lg+); en móvil se cierra con el backdrop o eligiendo un
          link. El logo se oculta cuando está colapsado para dejar
          solo el toggle centrado. */}
      <div
        className={`flex items-center justify-between gap-2 px-6 pt-7 pb-10 lg:pt-6 lg:pb-[50px] ${
          collapsed ? 'lg:px-3 lg:justify-center' : 'lg:px-5'
        }`}
      >
        {!collapsed && (
          <Link
            href="/app"
            aria-label="Ir a Resumen"
            onClick={closeDrawer}
            className="inline-block rounded-lg transition-opacity hover:opacity-85 active:opacity-70"
          >
            <Logo height={50} />
          </Link>
        )}
        {hydrated && (
          <IconButton
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            inline
            className="hidden lg:inline-flex shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={2.2} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={2.2} />
            )}
          </IconButton>
        )}
      </div>

      {/* Nav. Colapsado: solo icono centrado con tooltip; expandido:
          número + icono + label. La numeración se esconde porque pierde
          contexto sin texto al lado. */}
      <nav
        className={`flex-1 space-y-1.5 lg:space-y-1 overflow-y-auto px-4 ${
          collapsed ? 'lg:px-2' : 'lg:px-3'
        }`}
      >
        {NAV.map((item, idx) => {
          const isActive =
            item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`flex items-center rounded-xl text-body transition-all duration-200 ${
                collapsed
                  ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3.5 py-3 gap-3'
                  : 'gap-3 px-3.5 py-3 lg:py-2.5'
              } ${
                isActive
                  ? 'gradient-bg text-[#0B0B0C] font-semibold shadow-[0_4px_16px_rgba(61,220,151,.18)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)]'
              }`}
            >
              <span
                className={`text-eyebrow tabular-nums shrink-0 ${
                  isActive ? 'text-[#0B0B0C]/60' : 'text-[var(--muted2)]'
                } ${collapsed ? 'lg:hidden' : ''}`}
              >
                {idx + 1}.
              </span>
              <Icon size={16} strokeWidth={2} className="shrink-0" />
              <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Premium upsell — solo durante trial y nunca en colapsado
          (la card de upsell pierde sentido sin la copy completa). */}
      {plan === 'trial' && !collapsed && (
        <div className="mx-3 mb-3 mt-4 p-4 rounded-2xl bg-[var(--s2)] border border-[var(--border2)] gradient-border space-y-3 lg:block">
          <div className="text-body-sm font-semibold leading-snug">
            Desbloquea tu <span className="gradient-text">potencial</span> financiero.
          </div>
          <Link
            href="/pricing"
            className="w-full h-9 gradient-bg text-[#0B0B0C] font-semibold text-meta rounded-lg glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] inline-flex items-center justify-center"
          >
            Mejorar a Premium
          </Link>
        </div>
      )}

      {/* Help — solo el icono cuando colapsado, full link cuando no. */}
      <div className={`mb-3 ${collapsed ? 'lg:px-2' : 'px-5'}`}>
        <a
          href="mailto:soporte@marell.app?subject=Ayuda%20MARELL"
          title={collapsed ? 'Ayuda y soporte' : undefined}
          aria-label={collapsed ? 'Ayuda y soporte' : undefined}
          className={`flex items-center text-body-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors ${
            collapsed
              ? 'lg:justify-center lg:py-2 lg:rounded-lg lg:hover:bg-[var(--overlay-1)] gap-2 py-2'
              : 'gap-2 py-2'
          }`}
        >
          <LifeBuoy size={14} strokeWidth={2} />
          <span className={collapsed ? 'lg:hidden' : ''}>Ayuda y soporte</span>
        </a>
      </div>

      {/* User profile menu. Colapsado: solo avatar centrado; expandido:
          avatar + nombre + plan + chevron. */}
      <div
        ref={menuRef}
        className={`relative border-t border-[var(--border)] py-3 ${
          collapsed ? 'lg:px-2' : 'px-3'
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={collapsed ? `Cuenta · ${displayName ?? 'Usuario'}` : undefined}
          title={collapsed ? displayName ?? 'Usuario' : undefined}
          className={`w-full flex items-center rounded-lg transition-colors ${
            collapsed
              ? 'lg:justify-center lg:py-1.5 px-2 py-1.5 gap-2.5'
              : 'gap-2.5 px-2 py-1.5'
          } ${menuOpen ? 'bg-[var(--overlay-1)]' : 'hover:bg-[var(--overlay-1)]'}`}
        >
          <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-body-sm shrink-0">
            {initials}
          </div>
          <div className={`flex-1 min-w-0 text-left ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="text-body-sm font-medium truncate">{displayName ?? 'Usuario'}</div>
            <div className="text-eyebrow text-[var(--muted)] capitalize truncate">
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
            } ${collapsed ? 'lg:hidden' : ''}`}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={`absolute bottom-[calc(100%-4px)] mb-2 rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden animate-step ${
              collapsed
                ? 'lg:left-full lg:ml-2 lg:right-auto lg:w-[280px] left-3 right-3'
                : 'left-3 right-3'
            }`}
          >
            {/* Identity */}
            <div className="px-4 py-3.5 border-b border-[var(--border)] bg-[var(--overlay-1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-body shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-body-sm font-semibold truncate">
                    {displayName ?? 'Usuario'}
                  </div>
                  {email && (
                    <div className="text-eyebrow text-[var(--muted)] truncate">{email}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[var(--overlay-1)] border border-[var(--border)] text-tiny uppercase tracking-[0.15em] font-semibold text-[var(--text2)]">
                  {plan}
                </span>
                {trialDaysLeft !== null && (
                  <span
                    className={`text-eyebrow ${
                      trialDaysLeft <= 3 ? 'text-[var(--coral-text)]' : 'text-[var(--muted)]'
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
                className="flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
              >
                <CircleUser size={14} strokeWidth={2} className="text-[var(--text2)]" />
                Ajustes de cuenta
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
                >
                  <ShieldCheck size={14} strokeWidth={2} className="text-[var(--brand-text)]" />
                  Panel de admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleReset}
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors text-left"
              >
                <RotateCcw size={14} strokeWidth={2} className="text-[var(--text2)]" />
                Rehacer onboarding
              </button>
            </div>

            <form action={logout} className="border-t border-[var(--border)]">
              <button
                type="submit"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.08)] transition-colors"
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
