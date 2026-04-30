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
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Patrimonio
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

  const currentNetWorth = series.length > 0 ? series[series.length - 1].value : 0
  const startNetWorth = series.length > 0 ? series[0].value : 0
  const delta = currentNetWorth - startNetWorth
  const deltaPct =
    startNetWorth !== 0 ? (delta / Math.abs(startNetWorth)) * 100 : 0

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Patrimonio
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Tu <span className="gradient-text">patrimonio</span> en el tiempo.
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
          Reconstruido desde tus transacciones · {rangeLabel}
        </p>
      </div>

      {/* Range chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(RANGE_LABELS) as NetWorthRange[]).map((r) => {
          const active = range === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`h-8 px-4 text-[12px] font-medium rounded-full transition-colors ${
                active
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'bg-white/[0.04] text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.08]'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          )
        })}
      </div>

      {/* Hero KPI */}
      <div className="rounded-2xl border-2 border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)] px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold">
              Patrimonio neto · hoy
            </div>
            <div
              className={`text-[26px] sm:text-[36px] md:text-[44px] font-bold tabular-nums num leading-none mt-2 ${
                currentNetWorth < -0.005 ? 'text-[var(--coral)]' : 'gradient-text'
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
                  delta > 0 ? 'text-[var(--brand-2)]' : 'text-[var(--coral)]'
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
        <KpiCard
          label="Disponible"
          value={fmtMoney(totalCash)}
          Icon={Wallet}
          iconBg="bg-[rgba(61,220,151,0.10)]"
          iconColor="text-[var(--brand-2)]"
        />
        <KpiCard
          label="Inversiones"
          value={fmtMoney(totalAssets)}
          Icon={TrendingUp}
          iconBg="bg-[rgba(77,168,255,0.10)]"
          iconColor="text-[var(--info)]"
        />
        <KpiCard
          label="Deudas"
          value={fmtMoney(-totalDebts)}
          Icon={TrendingDown}
          iconBg="bg-[rgba(255,122,89,0.10)]"
          iconColor="text-[var(--coral)]"
        />
      </div>

      {/* Chart */}
      {!hasData ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
            <PiggyBank size={22} strokeWidth={2} />
          </div>
          <div className="text-[16px] text-[var(--text)] font-semibold">
            Sin datos suficientes
          </div>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
            Necesitas cuentas y algunas transacciones para reconstruir tu patrimonio en el tiempo.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Evolución mensual</h2>
            <div className="text-[11px] text-[var(--muted)]">
              {series.length} {series.length === 1 ? 'punto' : 'puntos'} ·{' '}
              <span className="text-[var(--text2)]">fin de mes</span>
            </div>
          </div>
          <NetWorthChart data={series} fmtMoney={fmtMoney} currency={currency} />
        </div>
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

interface KpiCardProps {
  label: string
  value: string
  Icon: typeof Wallet
  iconBg: string
  iconColor: string
}

function KpiCard({ label, value, Icon, iconBg, iconColor }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold tabular-nums num leading-none text-[var(--text)]">
        {value}
      </div>
    </div>
  )
}
