'use client'

import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ReadyToAssignProvider } from './ReadyToAssignProvider'
import { MobileNavProvider } from './MobileNavProvider'
import { CurrencyProvider } from './CurrencyProvider'
import { KeyboardShortcuts } from './KeyboardShortcuts'

interface AppShellProps {
  displayName: string | null
  email: string | null
  plan: string
  trialEndsAt: string | null
  budget: { id: string; name: string; currency: string } | null
  readyToAssign: number
  isAdmin?: boolean
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
            <TopBar displayName={displayName} currency={budget?.currency ?? 'DOP'} />
            <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7 max-w-[1400px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
        <KeyboardShortcuts />
      </MobileNavProvider>
    </ReadyToAssignProvider>
    </CurrencyProvider>
  )
}
