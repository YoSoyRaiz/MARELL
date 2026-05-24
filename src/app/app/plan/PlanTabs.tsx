'use client'

import Link from 'next/link'
import { Calendar, CalendarRange } from 'lucide-react'

interface PlanTabsProps {
  view: 'mensual' | 'anual'
}

/**
 * Tab nav at the top of Plan. URL-driven (the page renders different
 * server components per view), so the tabs are plain links instead of
 * controlled state — that way the URL is the source of truth and back/
 * forward navigation works naturally.
 */
export function PlanTabs({ view }: PlanTabsProps) {
  return (
    <div className="inline-flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)] gap-1">
      <Link
        href="/app/plan"
        prefetch
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
          view === 'mensual'
            ? 'gradient-bg text-[#0B0B0C]'
            : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)]'
        }`}
      >
        <Calendar size={13} strokeWidth={2.2} />
        Mensual
      </Link>
      <Link
        href="/app/plan?view=anual"
        prefetch
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
          view === 'anual'
            ? 'gradient-bg text-[#0B0B0C]'
            : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)]'
        }`}
      >
        <CalendarRange size={13} strokeWidth={2.2} />
        Anual
      </Link>
    </div>
  )
}
