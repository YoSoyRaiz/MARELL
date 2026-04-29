interface MonthPoint {
  month: string // YYYY-MM
  label: string // 'Abr', 'May', etc.
  income: number
  expense: number
}

interface IncomeExpenseChartProps {
  data: MonthPoint[]
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

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  if (data.length === 0) return null

  const rawMax = Math.max(...data.flatMap((d) => [d.income, d.expense]), 100)
  const yMax = niceCeil(rawMax)

  // Render with a fixed viewBox that scales to its container width.
  const padding = { top: 24, right: 12, bottom: 32, left: 56 }
  const groupPx = Math.max(56, 720 / data.length)
  const innerWidth = data.length * groupPx
  const totalWidth = innerWidth + padding.left + padding.right
  const totalHeight = 320
  const chartHeight = totalHeight - padding.top - padding.bottom

  // Each group has 2 bars. Allocate ~70% of the group width to bars.
  const groupBarsWidth = groupPx * 0.6
  const barWidth = (groupBarsWidth - 4) / 2
  const groupInnerStart = (groupPx - groupBarsWidth) / 2

  const yToPx = (value: number) =>
    padding.top + chartHeight - (value / yMax) * chartHeight

  const ticks = [0, 0.25, 0.5, 0.75, 1] as const

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label="Ingresos vs gastos por mes"
    >
      {/* Y gridlines + labels */}
      {ticks.map((t, i) => {
        const v = yMax * t
        const y = yToPx(v)
        return (
          <g key={i}>
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

      {/* Bars */}
      {data.map((d, i) => {
        const groupX = padding.left + i * groupPx
        const incomeH = (d.income / yMax) * chartHeight
        const expenseH = (d.expense / yMax) * chartHeight
        const incomeX = groupX + groupInnerStart
        const expenseX = incomeX + barWidth + 4
        return (
          <g key={d.month}>
            {/* Income bar */}
            <rect
              x={incomeX}
              y={yToPx(d.income)}
              width={barWidth}
              height={Math.max(0, incomeH)}
              fill="#3DDC97"
              rx="3"
              opacity={0.95}
            >
              <title>{`${d.label} · Ingresos ${fmtMoney(d.income)}`}</title>
            </rect>
            {/* Expense bar */}
            <rect
              x={expenseX}
              y={yToPx(d.expense)}
              width={barWidth}
              height={Math.max(0, expenseH)}
              fill="#FF7A59"
              rx="3"
              opacity={0.9}
            >
              <title>{`${d.label} · Gastos ${fmtMoney(d.expense)}`}</title>
            </rect>
            {/* X label */}
            <text
              x={groupX + groupPx / 2}
              y={totalHeight - 10}
              textAnchor="middle"
              fill="rgba(200,200,192,0.6)"
              fontSize="11"
              fontFamily="ui-sans-serif"
            >
              {d.label}
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
    </svg>
  )
}
