'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChartPie, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { MultiSegmentDonut } from './MultiSegmentDonut'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'
import { Card } from '@/components/ui/Card'
import { useFormatMoney, useFormatMoneyShort } from '../CurrencyProvider'

// Brand-aligned palette for category segments. The 6th and beyond
// are aggregated into "Otros" rendered in a muted gray.
export const SEGMENT_COLORS = [
  '#3DDC97', // brand-2 — vivid green
  '#2EC4B6', // brand-1 — teal
  '#8AC926', // brand-3 — lime
  '#4DA8FF', // info — blue
  '#F5C842', // warn — amber
] as const

const OTHER_COLOR = 'rgba(255,255,255,0.18)'


export type Period = 'month' | 'last_month' | 'three_months' | 'year' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Este mes',
  last_month: 'Mes pasado',
  three_months: '3 meses',
  year: 'Año',
  all: 'Todas',
}

export interface CategoryRow {
  id: string
  name: string
  amount: number // positive (sum of |spending|)
}

interface Props {
  period: Period
  totalIncome: number
  totalExpenses: number
  categoryRows: CategoryRow[]
  uncategorizedExpense: number
  hasBudget: boolean
  hasData: boolean
  periodLabel: string
}

export function AnalisisClient({
  period,
  totalIncome,
  totalExpenses,
  categoryRows,
  uncategorizedExpense,
  hasBudget,
  hasData,
  periodLabel,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()

  const setPeriod = (next: Period) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'month') sp.delete('period')
    else sp.set('period', next)
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis')
    })
  }

  const net = totalIncome - totalExpenses
  const sumCategorized = categoryRows.reduce((s, r) => s + r.amount, 0)
  const allRows: CategoryRow[] = uncategorizedExpense > 0.005
    ? [
        ...categoryRows,
        { id: '__uncategorized', name: 'Sin categoría', amount: uncategorizedExpense },
      ].sort((a, b) => b.amount - a.amount)
    : [...categoryRows]

  // Build segments: top 5 colored, rest aggregated as "Otros"
  const top = allRows.slice(0, 5)
  const rest = allRows.slice(5)
  const otherSum = rest.reduce((s, r) => s + r.amount, 0)
  const segments = [
    ...top.map((row, i) => ({ value: row.amount, color: SEGMENT_COLORS[i] })),
    ...(otherSum > 0 ? [{ value: otherSum, color: OTHER_COLOR }] : []),
  ]

  const totalForBars = totalExpenses > 0 ? totalExpenses : 1

  if (!hasBudget) {
    return (
      <PageHeader
        eyebrow="Análisis"
        description="Termina el onboarding para empezar a ver tus reportes."
      >
        Sin presupuesto <span className="gradient-text">aún</span>.
      </PageHeader>
    )
  }

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <PageHeader
        eyebrow="Análisis"
        description={`Distribución de gastos por categoría · ${periodLabel}`}
      >
        ¿En qué se va tu <span className="gradient-text">dinero</span>?
      </PageHeader>

      <SegmentedTabs
        value={period}
        onChange={setPeriod}
        ariaLabel="Período"
        options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({
          value: p,
          label: PERIOD_LABELS[p],
        }))}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Gastos"
          value={fmtMoney(totalExpenses)}
          Icon={TrendingDown}
          iconBg="bg-[rgba(255,122,89,0.10)]"
          iconColor="text-[var(--coral-text)]"
          size="lg"
          valueClass={totalExpenses < -0.005 ? 'text-[var(--coral-text)]' : 'text-[var(--text)]'}
        />
        <Stat
          label="Ingresos"
          value={fmtMoney(totalIncome)}
          Icon={TrendingUp}
          iconBg="bg-[rgba(61,220,151,0.10)]"
          iconColor="text-[var(--brand-text)]"
          size="lg"
          valueClass={totalIncome < -0.005 ? 'text-[var(--coral-text)]' : 'text-[var(--text)]'}
        />
        <Stat
          label="Neto"
          value={fmtMoney(net)}
          Icon={Wallet}
          size="lg"
          valueClass={
            net > 0.005
              ? 'gradient-text'
              : net < -0.005
                ? 'text-[var(--coral-text)]'
                : 'text-[var(--text)]'
          }
        />
        <Stat
          label="Categorías activas"
          value={Math.round(allRows.length)}
          Icon={ChartPie}
          iconBg="bg-[rgba(77,168,255,0.10)]"
          iconColor="text-[var(--info-text)]"
          size="lg"
        />
      </div>

      {/* Donut + ranked list */}
      {!hasData ? (
        <EmptyState
          Icon={ChartPie}
          title="Sin gastos en este período"
          description='Cuando registres gastos, aparecerá aquí la distribución por categoría. Prueba ampliar el rango con "Todas".'
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
          {/* Donut */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-6 flex flex-col items-center">
            <div className="relative">
              <MultiSegmentDonut segments={segments} size={200} stroke={22} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-semibold">
                    Total
                  </div>
                  <div className="text-[22px] font-bold tabular-nums num text-[var(--text)] mt-0.5">
                    {fmtMoneyShort(totalExpenses)}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-4 text-center leading-relaxed">
              Top {Math.min(5, allRows.length)} en colores ·{' '}
              {rest.length > 0 ? `${rest.length} en gris` : 'todo visible'}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Por categoría</h2>
              <p className="text-[12px] text-[var(--muted)]">
                {allRows.length} {allRows.length === 1 ? 'categoría' : 'categorías'}
              </p>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {allRows.map((r, i) => {
                const pct = (r.amount / totalForBars) * 100
                const Icon =
                  r.id === '__uncategorized'
                    ? null
                    : iconForCategoryName(r.name)
                const color = i < 5 ? SEGMENT_COLORS[i] : OTHER_COLOR
                return (
                  <li key={r.id} className="px-5 py-3.5 grid grid-cols-[auto_1fr_auto] gap-3 items-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon && (
                          <Icon
                            size={14}
                            strokeWidth={2}
                            className="text-[var(--text2)] shrink-0"
                          />
                        )}
                        <span className="text-[14px] text-[var(--text)] truncate">
                          {r.name}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[var(--overlay-1)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] tabular-nums num font-semibold text-[var(--text)]">
                        {fmtMoney(r.amount)}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] tabular-nums">
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

