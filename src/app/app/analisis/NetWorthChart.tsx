interface NetWorthPoint {
  month: string
  label: string
  value: number
}

import { formatMoney as fmtDefault, currencySymbol, type Currency } from '@/lib/money'

interface NetWorthChartProps {
  data: NetWorthPoint[]
  fmtMoney?: (n: number) => string
  currency?: Currency
}

const makeAxisFmt = (currency: Currency) => {
  const sym = currencySymbol(currency)
  return (n: number) => {
    if (n === 0) return `${sym}0`
    const sign = n < 0 ? '−' : ''
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}k`
    return `${sign}${sym}${Math.round(abs)}`
  }
}

const niceCeil = (v: number): number => {
  if (v <= 0) return 100
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const m = v / base
  let n = 1
  if (m > 1) n = 2
  if (m > 2) n = 5
  if (m > 5) n = 10
  return n * base
}

const niceFloor = (v: number): number => {
  if (v >= 0) return 0
  return -niceCeil(-v)
}

export function NetWorthChart({
  data,
  fmtMoney = (n) => fmtDefault(n, 'DOP'),
  currency = 'DOP',
}: NetWorthChartProps) {
  const fmtAxis = makeAxisFmt(currency)
  if (data.length === 0) return null

  const values = data.map((d) => d.value)
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const yMax = niceCeil(Math.max(rawMax, 100))
  const yMin = niceFloor(rawMin)

  const padding = { top: 24, right: 16, bottom: 32, left: 64 }
  const groupPx = Math.max(56, 720 / Math.max(data.length, 1))
  const innerWidth = (data.length - 1) * groupPx + groupPx
  const totalWidth = innerWidth + padding.left + padding.right
  const totalHeight = 340
  const chartHeight = totalHeight - padding.top - padding.bottom

  const xToPx = (i: number) => padding.left + groupPx / 2 + i * groupPx
  const yToPx = (v: number) => {
    const span = yMax - yMin || 1
    return padding.top + chartHeight * (1 - (v - yMin) / span)
  }

  const lastValue = values[values.length - 1] ?? 0
  const isPositive = lastValue >= -0.005
  const lineColor = isPositive ? '#3DDC97' : '#FF7A59'
  const fillId = isPositive ? 'nw-fill-pos' : 'nw-fill-neg'

  const linePath = `M ${data
    .map((d, i) => `${xToPx(i)},${yToPx(d.value)}`)
    .join(' L ')}`

  const baseY = yMin < -0.005 ? yToPx(yMin) : yToPx(0)
  const firstX = xToPx(0)
  const lastX = xToPx(data.length - 1)
  const areaPath = `${linePath} L ${lastX},${baseY} L ${firstX},${baseY} Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1] as const
  const showZeroLine = yMin < -0.005 && yMax > 0.005
  const zeroY = yToPx(0)

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label="Patrimonio neto en el tiempo"
    >
      <defs>
        <linearGradient id="nw-fill-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3DDC97" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#3DDC97" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#3DDC97" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nw-fill-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7A59" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#FF7A59" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FF7A59" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y gridlines + labels */}
      {ticks.map((t, i) => {
        const v = yMin + (yMax - yMin) * t
        const y = yToPx(v)
        return (
          <g key={`grid-${i}`}>
            <line
              x1={padding.left}
              x2={totalWidth - padding.right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fill="rgba(200,200,192,0.4)"
              fontSize="10"
              fontFamily="ui-monospace,monospace"
            >
              {fmtAxis(v)}
            </text>
          </g>
        )
      })}

      {/* Zero reference line (only if range crosses zero) */}
      {showZeroLine && (
        <line
          x1={padding.left}
          x2={totalWidth - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      )}

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#${fillId})`}
        style={{ transition: 'd .5s cubic-bezier(.25,.46,.45,.94)' }}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {data.map((d, i) => (
        <circle
          key={`dot-${i}`}
          cx={xToPx(i)}
          cy={yToPx(d.value)}
          r="3.5"
          fill="#0B0B0C"
          stroke={lineColor}
          strokeWidth="2"
        >
          <title>
            {d.label}: {fmtMoney(d.value)}
          </title>
        </circle>
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text
          key={`x-${i}`}
          x={xToPx(i)}
          y={totalHeight - 10}
          textAnchor="middle"
          fill="rgba(200,200,192,0.6)"
          fontSize="11"
          fontFamily="ui-sans-serif"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}
