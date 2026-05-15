'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { SpendingTrendsChart } from './SpendingTrendsChart'
import { ReportEmptyState } from './ReportEmptyState'
import { SEGMENT_COLORS } from './AnalisisClient'
import { useCurrency, useFormatMoney } from '../CurrencyProvider'

export type TrendsRange = 'six_months' | 'twelve_months' | 'twenty_four_months'

const RANGE_LABELS: Record<TrendsRange, string> = {
  six_months: '6 meses',
  twelve_months: '12 meses',
  twenty_four_months: '24 meses',
}


export interface TrendCategory {
  id: string
  name: string
  total: number // sum across the range
  values: number[] // per month, same order as months prop
}

export interface TrendMonth {
  month: string // YYYY-MM
  label: string // 'Abr'
}

interface Props {
  range: TrendsRange
  rangeLabel: string
  months: TrendMonth[]
  categories: TrendCategory[]
  hasBudget: boolean
  hasData: boolean
}

export function SpendingTrendsReport({
  range,
  rangeLabel,
  months,
  categories,
  hasBudget,
  hasData,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const fmtMoney = useFormatMoney()
  const currency = useCurrency()

  const setRange = (next: TrendsRange) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'twelve_months') sp.delete('range')
    else sp.set('range', next)
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis?report=trends')
    })
  }

  if (!hasBudget) {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Tendencias
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Sin presupuesto <span className="gradient-text">aún</span>.
        </h1>
        <p className="text-[var(--text2)] text-[14px] max-w-xl">
          Termina el onboarding para ver este reporte.
        </p>
      </div>
    )
  }

  const lines = categories.map((c, i) => ({
    id: c.id,
    name: c.name,
    color: SEGMENT_COLORS[i] ?? 'rgba(255,255,255,0.18)',
    values: c.values,
  }))

  const monthCount = months.length || 1

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Tendencias
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Hacia dónde se mueven tus <span className="gradient-text">gastos</span>.
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
          Top {Math.min(5, categories.length)}{' '}
          {categories.length === 1 ? 'categoría' : 'categorías'} mes a mes · {rangeLabel}
        </p>
      </div>

      {/* Range chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(RANGE_LABELS) as TrendsRange[]).map((r) => {
          const active = range === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`h-8 px-4 text-[12px] font-medium rounded-full transition-colors ${
                active
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'bg-[var(--overlay-1)] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-3)]'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {!hasData ? (
        <ReportEmptyState
          Icon={TrendingUp}
          title="Sin gastos en este rango"
          description="Cuando registres gastos, vas a ver aquí cómo se mueven mes a mes."
        />
      ) : (
        <>
          {/* Chart */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Por categoría</h2>
              <div className="flex items-center gap-3 text-[12px] flex-wrap">
                {lines.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1.5 text-[var(--text2)]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate max-w-[140px]">{l.name}</span>
                  </span>
                ))}
              </div>
            </div>
            <SpendingTrendsChart
              lines={lines}
              months={months}
              fmtMoney={fmtMoney}
              currency={currency}
            />
          </div>

          {/* Categories detail */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
                Detalle
              </h3>
              <span className="text-[11px] text-[var(--muted)]">
                {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
              </span>
            </div>
            <div className="hidden md:grid grid-cols-[auto_1fr_140px_140px] gap-4 px-5 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
              <div className="w-3"></div>
              <div>Categoría</div>
              <div className="text-right">Total</div>
              <div className="text-right">Promedio mes</div>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {categories.map((c, i) => {
                const Icon = iconForCategoryName(c.name)
                const avg = c.total / monthCount
                const color = SEGMENT_COLORS[i] ?? 'rgba(255,255,255,0.18)'
                return (
                  <li
                    key={c.id}
                    className="grid grid-cols-[auto_1fr_140px_140px] gap-4 px-5 py-3 items-center"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon size={14} strokeWidth={2} className="text-[var(--text2)] shrink-0" />
                      <span className="text-[14px] text-[var(--text)] truncate">{c.name}</span>
                    </div>
                    <div className="text-right text-[14px] tabular-nums num font-semibold text-[var(--text)]">
                      {fmtMoney(c.total)}
                    </div>
                    <div className="text-right text-[13px] tabular-nums num text-[var(--text2)]">
                      {fmtMoney(avg)}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
