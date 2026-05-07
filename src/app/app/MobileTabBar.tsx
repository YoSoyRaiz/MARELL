'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  ArrowLeftRight,
  Menu,
  Plus,
} from 'lucide-react'
import { SHORTCUT_EVENTS } from './KeyboardShortcuts'

interface TabItem {
  id: string
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** When true the tab is `active` whenever the path starts with `href`
   *  rather than matching exactly — useful for sub-routes like
   *  /app/transacciones?month=… or /app/mas/sub. */
  prefix?: boolean
}

// Five-tab bottom nav per the mobile mockup. Order is by frequency
// of use: the user mostly toggles between Resumen and Plan, with
// Asignar (the brand FAB) sitting between them, and Transacciones +
// Más on the right.
const TABS: TabItem[] = [
  { id: 'resumen', label: 'Resumen', href: '/app', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', href: '/app/plan', icon: Sparkles, prefix: true },
  // Asignar is a center FAB — handled inline below, not a regular tab.
  {
    id: 'transacciones',
    label: 'Movimientos',
    href: '/app/transacciones',
    icon: ArrowLeftRight,
    prefix: true,
  },
  { id: 'mas', label: 'Más', href: '/app/mas', icon: Menu, prefix: true },
]

function isActive(path: string | null, item: TabItem): boolean {
  if (!path) return false
  if (item.href === '/app') return path === '/app'
  if (item.prefix) return path.startsWith(item.href)
  return path === item.href
}

/**
 * Sticky bottom bar shown only on mobile / tablet. Triggers the same
 * "assign money" custom event the topbar listens for, so the FAB
 * opens the existing AssignPopover without a separate code path.
 */
export function MobileTabBar() {
  const pathname = usePathname()
  const router = useRouter()

  // FAB now opens the new-transaction modal. If the user is already on
  // /app/transacciones we just dispatch the event so the page's existing
  // listener picks it up; otherwise we navigate there with ?new=1 and
  // TransactionsClient auto-opens the modal on arrival.
  const triggerNewTransaction = () => {
    if (pathname?.startsWith('/app/transacciones')) {
      window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.newTransaction))
    } else {
      router.push('/app/transacciones?new=1')
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 items-end h-[68px] px-2">
        {TABS.slice(0, 2).map((t) => (
          <TabLink key={t.id} item={t} active={isActive(pathname, t)} />
        ))}
        <li className="flex items-end justify-center">
          <button
            type="button"
            onClick={triggerNewTransaction}
            aria-label="Nueva transacción"
            className="-mt-7 w-[58px] h-[58px] rounded-full gradient-bg text-[#0B0B0C] flex items-center justify-center shadow-[0_12px_32px_rgba(61,220,151,0.45)] active:scale-95 transition-transform"
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </li>
        {TABS.slice(2).map((t) => (
          <TabLink key={t.id} item={t} active={isActive(pathname, t)} />
        ))}
      </ul>
    </nav>
  )
}

function TabLink({ item, active }: { item: TabItem; active: boolean }) {
  const Icon = item.icon
  return (
    <li className="flex items-stretch justify-center">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 w-full pt-3 pb-2 transition-colors ${
          active ? 'text-[var(--brand-text)]' : 'text-[var(--text2)]'
        }`}
      >
        <Icon
          size={20}
          strokeWidth={active ? 2.4 : 2}
          className="transition-transform"
        />
        <span className="text-[10px] font-semibold tracking-wide">
          {item.label}
        </span>
      </Link>
    </li>
  )
}
