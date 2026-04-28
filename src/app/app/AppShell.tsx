'use client'

import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ReadyToAssignProvider } from './ReadyToAssignProvider'

interface AppShellProps {
  displayName: string | null
  plan: string
  budget: { id: string; name: string; currency: string } | null
  readyToAssign: number
  children: ReactNode
}

export function AppShell({ displayName, plan, budget, readyToAssign, children }: AppShellProps) {
  return (
    <ReadyToAssignProvider initialValue={readyToAssign}>
      <div className="min-h-screen bg-[var(--bg)] flex">
        <Sidebar displayName={displayName} plan={plan} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar displayName={displayName} currency={budget?.currency ?? 'DOP'} />
          <main className="flex-1 px-8 py-7 max-w-[1400px] w-full mx-auto">{children}</main>
        </div>
      </div>
    </ReadyToAssignProvider>
  )
}
