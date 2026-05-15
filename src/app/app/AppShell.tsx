'use client'

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
  children,
}: AppShellProps) {
  return (
    <CurrencyProvider currency={budget?.currency ?? 'DOP'}>
    <ReadyToAssignProvider initialValue={readyToAssign}>
      <MobileNavProvider>
        <div className="min-h-screen bg-[var(--bg)] flex">
          <Sidebar
            displayName={displayName}
            email={email}
            plan={plan}
            trialEndsAt={trialEndsAt}
            isAdmin={isAdmin}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <OfflineBanner />
            <TrialBanner plan={plan} trialEndsAt={trialEndsAt} />
            <TopBar
              displayName={displayName}
              currency={budget?.currency ?? 'DOP'}
              notifications={notifications}
              notificationsLastSeen={notificationsLastSeen}
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
