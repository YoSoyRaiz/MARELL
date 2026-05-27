'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ChartPie,
  Scale,
  TrendingUp,
  Wallet,
  Hourglass,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ExportButton } from './ExportButton'

export type ReportKey =
  | 'breakdown'
  | 'income_expense'
  | 'trends'
  | 'networth'
  | 'age_of_money'
  | 'debt_health'

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
  { id: 'debt_health', label: 'Salud de deudas', Icon: ShieldAlert, enabled: true },
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
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Tab nav + Export action. Flex con justify-between para que el
          botón vaya a la derecha en desktop; en mobile se apila debajo
          (flex-wrap) para no romper el scroll horizontal de tabs. */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-[var(--overlay-1)] rounded-xl overflow-x-auto flex-1 min-w-0">
          {TABS.map((t) => {
            const isActive = active === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => t.enabled && setReport(t.id)}
                disabled={!t.enabled}
                title={t.enabled ? undefined : 'Próximamente'}
                className={`h-9 px-4 text-body-sm font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[var(--s1)] text-[var(--text)] shadow-[inset_0_-2px_0_var(--brand-2)]'
                    : t.enabled
                      ? 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)]'
                      : 'text-[var(--muted2)] cursor-not-allowed'
                }`}
              >
                <t.Icon size={14} strokeWidth={2.2} />
                {t.label}
              </button>
            )
          })}
        </div>
        <ExportButton />
      </div>

      {children}
    </div>
  )
}
