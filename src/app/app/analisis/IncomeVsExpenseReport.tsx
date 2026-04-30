'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TrendingUp, TrendingDown, Wallet, Percent, Scale } from 'lucide-react'
import { IncomeExpenseChart } from './IncomeExpenseChart'
import { useCurrency, useFormatMoney } from '../CurrencyProvider'

export type Range = 'six_months' | 'twelve_months' | 'twenty_four_months' | 'all'

const RANGE_LABELS: Record<Range, string> = {
  six_months: '6 meses',
  twelve_months: '12 meses',
  twenty_four_months: '24 meses',
  all: 'Todos',
}


export interface MonthAggregate {
  month: string // YYYY-MM
  label: string
  income: number
  expense: number
}

interface Props {
  range: Range
  rangeLabel: string
  months: MonthAggregate[]
  totalIncome: number
  totalExpense: number
  hasBudget: boolean
  hasData: boolean
}

export function IncomeVsExpenseReport({
  range,
  rangeLabel,
  months,
  totalIncome,
  totalExpense,
  hasBudget,
  hasData,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const fmtMoney = useFormatMoney()
  const currency = useCurrency()

  const setRange = (next: Range) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'twelve_months') sp.delete('range')
    else sp.set('range', next)
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis?report=income_expense')
    })
  }

  const net = totalIncome - totalExpense
  const savingsRate = totalIncome > 0.005 ? (net / totalIncome) * 100 : 0

  if (!hasBudget) {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Ingresos vs Gastos
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

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Análisis · Ingresos vs Gastos
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          ¿Estás <span className="gradient-text">ahorrando</span> o gastando?
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
          Comparativa mes por mes · {rangeLabel}
        </p>
      </div>

      {/* Range chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => {
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos totales"
          value={fmtMoney(totalIncome)}
          Icon={TrendingUp}
          iconBg="bg-[rgba(61,220,151,0.10)]"
          iconColor="text-[var(--brand-2)]"
        />
        <KpiCard
          label="Gastos totales"
          value={fmtMoney(totalExpense)}
          Icon={TrendingDown}
          iconBg="bg-[rgba(255,122,89,0.10)]"
          iconColor="text-[var(--coral)]"
        />
        <KpiCard
          label="Neto"
          value={fmtMoney(net)}
          Icon={Wallet}
          iconBg="bg-white/[0.04]"
          iconColor="text-[var(--text2)]"
          valueClass={
            net > 0.005
              ? 'gradient-text'
              : net < -0.005
                ? 'text-[var(--coral)]'
                : 'text-[var(--text)]'
          }
        />
        <KpiCard
          label="Tasa de ahorro"
          value={
            totalIncome > 0.005
              ? `${savingsRate.toFixed(1)}%`
              : '—'
          }
          Icon={Percent}
          iconBg="bg-[rgba(77,168,255,0.10)]"
          iconColor="text-[var(--info)]"
          valueClass={
            savingsRate > 0
              ? 'gradient-text'
              : savingsRate < 0
                ? 'text-[var(--coral)]'
                : 'text-[var(--text)]'
          }
        />
      </div>

      {/* Chart */}
      {!hasData ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
            <Scale size={22} strokeWidth={2} />
          </div>
          <div className="text-[16px] text-[var(--text)] font-semibold">
            Sin movimientos en el rango
          </div>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
            Cuando registres ingresos y gastos, vas a ver acá la comparación mes a mes.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                Por mes
              </h2>
              <div className="flex items-center gap-4 text-[12px]">
                <LegendDot color="#3DDC97" label="Ingresos" />
                <LegendDot color="#FF7A59" label="Gastos" />
              </div>
            </div>
            <IncomeExpenseChart data={months} fmtMoney={fmtMoney} currency={currency} />
          </div>

          {/* Month-by-month table */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                Detalle
              </h3>
              <span className="text-[11px] text-[var(--muted)]">
                {months.length} {months.length === 1 ? 'mes' : 'meses'}
              </span>
            </div>
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_140px] gap-4 px-5 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
              <div>Mes</div>
              <div className="text-right">Ingresos</div>
              <div className="text-right">Gastos</div>
              <div className="text-right">Neto</div>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {[...months].reverse().map((m) => {
                const monthNet = m.income - m.expense
                return (
                  <li
                    key={m.month}
                    className="grid grid-cols-[1fr_140px_140px_140px] gap-4 px-5 py-3 items-center text-[13px]"
                  >
                    <div className="text-[var(--text)]">{m.label}</div>
                    <div className="text-right tabular-nums num text-[var(--brand-2)]">
                      {fmtMoney(m.income)}
                    </div>
                    <div className="text-right tabular-nums num text-[var(--text)]">
                      {fmtMoney(m.expense)}
                    </div>
                    <div
                      className={`text-right tabular-nums num font-semibold ${
                        monthNet > 0.005
                          ? 'gradient-text'
                          : monthNet < -0.005
                            ? 'text-[var(--coral)]'
                            : 'text-[var(--muted)]'
                      }`}
                    >
                      {fmtMoney(monthNet)}
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--text2)]">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

interface KpiCardProps {
  label: string
  value: string
  Icon: typeof TrendingUp
  iconBg: string
  iconColor: string
  valueClass?: string
}

function KpiCard({ label, value, Icon, iconBg, iconColor, valueClass }: KpiCardProps) {
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
      <div
        className={`text-[22px] font-bold tabular-nums num leading-none ${
          valueClass ?? 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
