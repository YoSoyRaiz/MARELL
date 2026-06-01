// AppShell es Server Component — solo arma el layout estático y pasa
// children al árbol. Los providers + sidebar + topbar tienen su propio
// 'use client'. Antes este archivo era 'use client' lo que metía todo
// el subtree en el bundle inicial sin razón. (Auditoría calidad M3.)
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ReadyToAssignProvider } from './ReadyToAssignProvider'
import { MobileNavProvider } from './MobileNavProvider'
import { CurrencyProvider } from './CurrencyProvider'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { OfflineBanner } from './OfflineBanner'
import { MobileTabBar } from './MobileTabBar'
import { TrialBanner } from './TrialBanner'
import type { NotificationItem } from './NotificationBell'
import type { UserBudgetListItem } from '@/lib/budget/active'

interface AppShellProps {
  displayName: string | null
  email: string | null
  plan: string
  trialEndsAt: string | null
  budget: { id: string; name: string; currency: string } | null
  readyToAssign: number
  isAdmin?: boolean
  notifications?: NotificationItem[]
  notificationsLastSeen?: string | null
  /** Lista de budgets accesibles (propios + compartidos). Lo
   *  pasamos desde el layout para que el TopBar pueda renderizar
   *  el BudgetSwitcher sin un round-trip extra. */
  budgets?: UserBudgetListItem[]
  children: ReactNode
}

export function AppShell({
  displayName,
  email,
  plan,
  trialEndsAt,
  budget,
  readyToAssign,
  isAdmin = false,
  notifications = [],
  notificationsLastSeen = null,
  budgets = [],
  children,
}: AppShellProps) {
  return (
    <CurrencyProvider currency={budget?.currency ?? 'DOP'}>
    <ReadyToAssignProvider initialValue={readyToAssign}>
      <MobileNavProvider>
        {/* Layout sin flex: el Sidebar es lg:fixed left:0, así que el
            contenido principal solo necesita un margin-left igual al
            ancho del sidebar para no quedar tapado. El ancho se lee
            de la CSS variable `--sidebar-w` que el Sidebar mantiene
            sincronizada (toggle expandido/colapsado). */}
        <div className="min-h-screen bg-[var(--bg)]">
          <Sidebar
            displayName={displayName}
            email={email}
            plan={plan}
            trialEndsAt={trialEndsAt}
            isAdmin={isAdmin}
          />
          <div className="flex flex-col min-w-0 transition-[margin] duration-300 ease-out lg:ml-[var(--sidebar-w,240px)]">
            <OfflineBanner />
            <TrialBanner plan={plan} trialEndsAt={trialEndsAt} />
            <TopBar
              displayName={displayName}
              currency={budget?.currency ?? 'DOP'}
              notifications={notifications}
              notificationsLastSeen={notificationsLastSeen}
              budgets={budgets}
              activeBudgetId={budget?.id ?? null}
            />
            {/* Bottom padding on mobile clears the fixed MobileTabBar
                (68px tall + iOS safe-area). On desktop the tab bar is
                hidden so no padding needed. */}
            <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7 max-w-[1700px] w-full mx-auto pb-[calc(68px+env(safe-area-inset-bottom)+24px)] lg:pb-7">
              {children}
            </main>
          </div>
        </div>
        <KeyboardShortcuts />
        <MobileTabBar />
      </MobileNavProvider>
    </ReadyToAssignProvider>
    </CurrencyProvider>
  )
}
