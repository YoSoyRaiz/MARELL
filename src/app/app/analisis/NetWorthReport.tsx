'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { NetWorthChart } from './NetWorthChart'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Stat } from '@/components/ui/Stat'
import { Card } from '@/components/ui/Card'
import { useCurrency, useFormatMoney } from '../CurrencyProvider'

export type NetWorthRange = 'six_months' | 'twelve_months' | 'twenty_four_months'

const RANGE_LABELS: Record<NetWorthRange, string> = {
  six_months: '6 meses',
  twelve_months: '12 meses',
  twenty_four_months: '24 meses',
}


export interface NetWorthPoint {
  month: string
  label: string
  value: number
}

interface Props {
  range: NetWorthRange
  rangeLabel: string
  series: NetWorthPoint[]
  totalCash: number
  totalAssets: number
  totalDebts: number
  hasBudget: boolean
  hasData: boolean
}

export function NetWorthReport({
  range,
  rangeLabel,
  series,
  totalCash,
  totalAssets,
  totalDebts,
  hasBudget,
  hasData,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const fmtMoney = useFormatMoney()
  const currency = useCurrency()

  const setRange = (next: NetWorthRange) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'twelve_months') sp.delete('range')
    else sp.set('range', next)
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis?report=networth')
    })
  }

  if (!hasBudget) {
    return (
      <PageHeader
        eyebrow="Análisis · Patrimonio"
        description="Termina el onboarding para ver este reporte."
      >
        Sin presupuesto <span className="gradient-text">aún</span>.
      </PageHeader>
    )
  }

  const currentNetWorth = series.length > 0 ? series[series.length - 1].value : 0
  const startNetWorth = series.length > 0 ? series[0].value : 0
  const delta = currentNetWorth - startNetWorth
  const deltaPct =
    startNetWorth !== 0 ? (delta / Math.abs(startNetWorth)) * 100 : 0

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <PageHeader
        eyebrow="Análisis · Patrimonio"
        description={`Reconstruido desde tus transacciones · ${rangeLabel}`}
      >
        Tu <span className="gradient-text">patrimonio</span> en el tiempo.
      </PageHeader>

      <SegmentedTabs
        value={range}
        onChange={setRange}
        ariaLabel="Rango"
        options={(Object.keys(RANGE_LABELS) as NetWorthRange[]).map((r) => ({
          value: r,
          label: RANGE_LABELS[r],
        }))}
      />

      {/* Hero KPI */}
      <div className="rounded-2xl border-2 border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)] px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
              Patrimonio neto · hoy
            </div>
            <div
              className={`text-[26px] sm:text-[36px] md:text-[44px] font-bold tabular-nums num leading-none mt-2 ${
                currentNetWorth < -0.005 ? 'text-[var(--coral-text)]' : 'gradient-text'
              }`}
            >
              {fmtMoney(currentNetWorth)}
            </div>
          </div>
          {series.length > 1 && Math.abs(delta) > 0.005 && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] font-semibold">
                vs hace {rangeLabel.toLowerCase()}
              </div>
              <div
                className={`text-[20px] font-bold tabular-nums num mt-2 inline-flex items-center gap-1.5 ${
                  delta > 0 ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
                }`}
              >
                {delta > 0 ? (
                  <ArrowUp size={16} strokeWidth={2.4} />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.4} />
                )}
                {fmtMoney(Math.abs(delta))}
              </div>
              <div className="text-[12px] text-[var(--muted)] tabular-nums num mt-0.5">
                {deltaPct > 0 ? '+' : ''}
                {deltaPct.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Component cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat
          label="Disponible"
          value={fmtMoney(totalCash)}
          Icon={Wallet}
          iconBg="bg-[rgba(61,220,151,0.10)]"
          iconColor="text-[var(--brand-text)]"
        />
        <Stat
          label="Inversiones"
          value={fmtMoney(totalAssets)}
          Icon={TrendingUp}
          iconBg="bg-[rgba(77,168,255,0.10)]"
          iconColor="text-[var(--info-text)]"
        />
        <Stat
          label="Deudas"
          value={fmtMoney(-totalDebts)}
          Icon={TrendingDown}
          iconBg="bg-[rgba(255,122,89,0.10)]"
          iconColor="text-[var(--coral-text)]"
        />
      </div>

      {/* Chart */}
      {!hasData ? (
        <EmptyState
          Icon={PiggyBank}
          title="Sin datos suficientes"
          description="Necesitas cuentas y algunas transacciones para reconstruir tu patrimonio en el tiempo."
        />
      ) : (
        <Card padding="md" className="overflow-x-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Evolución mensual</h2>
            <div className="text-[11px] text-[var(--muted)]">
              {series.length} {series.length === 1 ? 'punto' : 'puntos'} ·{' '}
              <span className="text-[var(--text2)]">fin de mes</span>
            </div>
          </div>
          <NetWorthChart data={series} fmtMoney={fmtMoney} currency={currency} />
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-2xl">
        Reconstruimos cada punto restando las transacciones posteriores al cierre de mes desde el
        balance actual de cada cuenta. Es una aproximación cercana — más precisa mientras más
        transacciones registres.
      </p>
    </div>
  )
}

