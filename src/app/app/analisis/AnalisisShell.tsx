'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChartPie,
  Scale,
  TrendingUp,
  Wallet,
  Hourglass,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ReportKey =
  | 'breakdown'
  | 'income_expense'
  | 'trends'
  | 'networth'
  | 'age_of_money'

interface Tab {
  id: ReportKey
  label: string
  Icon: LucideIcon
  enabled: boolean
}

const TABS: Tab[] = [
  { id: 'breakdown', label: 'Gastos', Icon: ChartPie, enabled: true },
  { id: 'income_expense', label: 'Ingresos vs Gastos', Icon: Scale, enabled: true },
  { id: 'trends', label: 'Tendencias', Icon: TrendingUp, enabled: true },
  { id: 'networth', label: 'Patrimonio', Icon: Wallet, enabled: true },
  { id: 'age_of_money', label: 'Edad del dinero', Icon: Hourglass, enabled: true },
]

interface AnalisisShellProps {
  active: ReportKey
  children: React.ReactNode
}

export function AnalisisShell({ active, children }: AnalisisShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setReport = (next: ReportKey) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'breakdown') sp.delete('report')
    else sp.set('report', next)
    // Reset period/range when switching reports — they have different semantics
    sp.delete('period')
    sp.delete('range')
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis')
    })
  }

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Tab nav */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl overflow-x-auto">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => t.enabled && setReport(t.id)}
              disabled={!t.enabled}
              title={t.enabled ? undefined : 'Próximamente'}
              className={`h-9 px-4 text-[13px] font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'gradient-bg text-[#0B0B0C]'
                  : t.enabled
                    ? 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04]'
                    : 'text-[var(--muted2)] cursor-not-allowed'
              }`}
            >
              <t.Icon size={14} strokeWidth={2.2} />
              {t.label}
            </button>
          )
        })}
      </div>

      {children}
    </div>
  )
}
