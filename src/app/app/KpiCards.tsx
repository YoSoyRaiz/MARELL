import { TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface KpiCardsProps {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  netWorth: number
  prevMonthIncome: number
  prevMonthExpenses: number
  /** 6 puntos por defecto (mes actual + 5 anteriores). Solo se
   *  renderiza sparkline cuando hay >= 2 puntos con valor distinto
   *  de cero — un solo punto no es una tendencia. */
  incomeSeries?: number[]
  expenseSeries?: number[]
  /** Pre-formatted with currency. The page already has useFormatMoney
   *  wired via CurrencyProvider — pass the formatter so this component
   *  stays server-renderable without re-deriving currency state. */
  fmtMoney: (n: number) => string
}

interface KpiDef {
  label: string
  value: number
  prev: number | null
  series?: number[]
  Icon: LucideIcon
  iconBg: string
  iconColor: string
  /** Color stops for the sparkline gradient. Used both for trend tone
   *  and to keep each card's visualization consistent with its icon
   *  chip color. */
  sparkColor: string
  /** When the metric direction is inverted (e.g. higher gastos = worse),
   *  the % change badge flips its color logic so positive delta shows
   *  coral instead of green. */
  inverseDelta?: boolean
}

/**
 * Row of 4 KPI cards at the top of /app Resumen. Mirrors the dashboard
 * mockup target: Ingresos / Gastos / Ahorros / Patrimonio neto, each
 * with an icon chip, big number, sublabel, and (when comparable) a %
 * change badge vs previous month.
 *
 * Server component — no client state. Sparklines + animated mounts are
 * tracked for a follow-up; the current version focuses on getting the
 * numbers and layout into the user's view.
 */
export function KpiCards({
  totalIncome,
  totalExpenses,
  totalSavings,
  netWorth,
  prevMonthIncome,
  prevMonthExpenses,
  incomeSeries,
  expenseSeries,
  fmtMoney,
}: KpiCardsProps) {
  const kpis: KpiDef[] = [
    {
      label: 'Ingresos',
      value: totalIncome,
      prev: prevMonthIncome,
      series: incomeSeries,
      Icon: TrendingUp,
      iconBg: 'bg-[rgba(61,220,151,0.12)]',
      iconColor: 'text-[var(--brand-text)]',
      sparkColor: '#3DDC97',
    },
    {
      label: 'Gastos',
      value: totalExpenses,
      prev: prevMonthExpenses,
      series: expenseSeries,
      Icon: TrendingDown,
      iconBg: 'bg-[rgba(255,122,89,0.12)]',
      iconColor: 'text-[var(--coral-text)]',
      sparkColor: '#FF7A59',
      inverseDelta: true,
    },
    {
      label: 'Ahorros',
      value: totalSavings,
      prev: null,
      Icon: PiggyBank,
      iconBg: 'bg-[rgba(77,168,255,0.12)]',
      iconColor: 'text-[var(--info-text)]',
      sparkColor: '#4DA8FF',
    },
    {
      label: 'Patrimonio neto',
      value: netWorth,
      prev: null,
      Icon: Wallet,
      iconBg: 'bg-[rgba(245,200,66,0.12)]',
      iconColor: 'text-[var(--warn-text)]',
      sparkColor: '#F5C842',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <KpiCard key={k.label} kpi={k} fmtMoney={fmtMoney} />
      ))}
    </div>
  )
}

function KpiCard({
  kpi,
  fmtMoney,
}: {
  kpi: KpiDef
  fmtMoney: (n: number) => string
}) {
  const { label, value, prev, series, Icon, iconBg, iconColor, sparkColor, inverseDelta } = kpi
  const delta = computeDelta(value, prev)
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
        {delta && (
          <DeltaBadge
            percent={delta.percent}
            inverse={!!inverseDelta}
          />
        )}
      </div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
        {label}
      </p>
      <p className="num tabular-nums text-[20px] sm:text-[22px] font-bold mt-1 leading-tight text-[var(--text)]">
        {fmtMoney(value)}
      </p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <p className="text-[11px] text-[var(--muted)]">Este mes</p>
        {series && hasTrend(series) && (
          <Sparkline points={series} color={sparkColor} />
        )}
      </div>
    </div>
  )
}

/** Returns true when the series has >= 2 distinct values — otherwise a
 *  sparkline is just a flat line that adds noise instead of signal. */
function hasTrend(series: number[]): boolean {
  if (series.length < 2) return false
  const max = Math.max(...series)
  const min = Math.min(...series)
  return max - min > 0.01
}

/**
 * Mini SVG sparkline — 60px wide × 22px tall, single stroke path with
 * a soft fill underneath. Pure SVG, no JS, server-renderable. The path
 * scales the series into the box so even tiny numbers (savings of $50)
 * read against headline values ($5,000) without comparing magnitudes.
 */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const W = 60
  const H = 22
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const stepX = points.length > 1 ? W / (points.length - 1) : W
  const coords = points.map((v, i) => {
    const x = i * stepX
    // Invert Y so higher values draw higher on screen. Add 1px padding
    // top and bottom so the stroke never clips against the box edges.
    const y = H - 1 - ((v - min) / range) * (H - 2)
    return [x, y] as const
  })
  const path =
    'M ' +
    coords
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' L ')
  const fillPath = `${path} L ${W},${H} L 0,${H} Z`
  const gradId = `spark-${color.replace('#', '')}`
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className="shrink-0 opacity-90"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeltaBadge({
  percent,
  inverse,
}: {
  percent: number
  inverse: boolean
}) {
  // For inverse metrics (gastos), positive change = bad.
  const isGood = inverse ? percent < 0 : percent > 0
  const isFlat = Math.abs(percent) < 0.5
  const tone = isFlat
    ? 'bg-[var(--overlay-2)] text-[var(--muted2)]'
    : isGood
      ? 'bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)]'
      : 'bg-[rgba(255,122,89,0.12)] text-[var(--coral-text)]'
  const sign = percent > 0 ? '+' : ''
  return (
    <span
      className={`shrink-0 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${tone}`}
    >
      {sign}
      {percent.toFixed(percent > -10 && percent < 10 ? 1 : 0)}%
    </span>
  )
}

/**
 * Computes % delta between current and previous-month values. Returns
 * null when prev is missing or zero (avoid divide-by-zero infinity and
 * the awkward "+∞%" badge for first-month users).
 */
function computeDelta(
  current: number,
  prev: number | null,
): { percent: number } | null {
  if (prev === null || prev === undefined) return null
  if (Math.abs(prev) < 0.005) return null
  const percent = ((current - prev) / Math.abs(prev)) * 100
  if (!Number.isFinite(percent)) return null
  return { percent }
}
