interface TrendLine {
  id: string
  name: string
  color: string
  values: number[] // length === months.length
}

interface MonthLabel {
  month: string // YYYY-MM
  label: string // 'Abr'
}

interface SpendingTrendsChartProps {
  lines: TrendLine[]
  months: MonthLabel[]
}

const fmtAxis = (n: number) => {
  if (n === 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${Math.round(n)}`
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

export function SpendingTrendsChart({ lines, months }: SpendingTrendsChartProps) {
  if (months.length === 0 || lines.length === 0) return null

  const allValues = lines.flatMap((l) => l.values)
  const rawMax = Math.max(...allValues, 100)
  const yMax = niceCeil(rawMax)

  const padding = { top: 24, right: 16, bottom: 32, left: 56 }
  const groupPx = Math.max(56, 720 / months.length)
  const innerWidth = (months.length - 1) * groupPx + groupPx
  const totalWidth = innerWidth + padding.left + padding.right
  const totalHeight = 320
  const chartHeight = totalHeight - padding.top - padding.bottom

  const xToPx = (i: number) => padding.left + groupPx / 2 + i * groupPx
  const yToPx = (value: number) =>
    padding.top + chartHeight - (value / yMax) * chartHeight

  const ticks = [0, 0.25, 0.5, 0.75, 1] as const

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label="Tendencia de gastos por categoría"
    >
      {/* Y gridlines + labels */}
      {ticks.map((t, i) => {
        const v = yMax * t
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

      {/* X axis line */}
      <line
        x1={padding.left}
        x2={totalWidth - padding.right}
        y1={padding.top + chartHeight}
        y2={padding.top + chartHeight}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1"
      />

      {/* Lines */}
      {lines.map((line) => {
        const points = months
          .map((_, i) => `${xToPx(i)},${yToPx(line.values[i] ?? 0)}`)
          .join(' ')
        return (
          <g key={line.id}>
            <polyline
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
              style={{ transition: 'all .5s cubic-bezier(.25,.46,.45,.94)' }}
            />
            {months.map((m, i) => (
              <circle
                key={`${line.id}-${i}`}
                cx={xToPx(i)}
                cy={yToPx(line.values[i] ?? 0)}
                r="3"
                fill="#0B0B0C"
                stroke={line.color}
                strokeWidth="2"
              >
                <title>
                  {m.label}: {line.name} — {fmtMoney(line.values[i] ?? 0)}
                </title>
              </circle>
            ))}
          </g>
        )
      })}

      {/* X labels */}
      {months.map((m, i) => (
        <text
          key={`x-${i}`}
          x={xToPx(i)}
          y={totalHeight - 10}
          textAnchor="middle"
          fill="rgba(200,200,192,0.6)"
          fontSize="11"
          fontFamily="ui-sans-serif"
        >
          {m.label}
        </text>
      ))}
    </svg>
  )
}
