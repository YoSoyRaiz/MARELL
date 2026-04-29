interface AgeOfMoneyPoint {
  month: string
  label: string
  ageDays: number | null
}

interface AgeOfMoneyChartProps {
  data: AgeOfMoneyPoint[]
}

const niceCeil = (v: number): number => {
  if (v <= 0) return 10
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const m = v / base
  let n = 1
  if (m > 1) n = 2
  if (m > 2) n = 5
  if (m > 5) n = 10
  return n * base
}

export function AgeOfMoneyChart({ data }: AgeOfMoneyChartProps) {
  if (data.length === 0) return null

  const validValues = data.filter((d) => d.ageDays !== null).map((d) => d.ageDays as number)
  const maxValue = validValues.length > 0 ? Math.max(...validValues, 30) : 30
  const yMax = niceCeil(maxValue)

  const padding = { top: 24, right: 16, bottom: 32, left: 56 }
  const groupPx = Math.max(56, 720 / Math.max(data.length, 1))
  const innerWidth = (data.length - 1) * groupPx + groupPx
  const totalWidth = innerWidth + padding.left + padding.right
  const totalHeight = 320
  const chartHeight = totalHeight - padding.top - padding.bottom

  const xToPx = (i: number) => padding.left + groupPx / 2 + i * groupPx
  const yToPx = (v: number) => padding.top + chartHeight * (1 - v / yMax)

  const ticks = [0, 0.25, 0.5, 0.75, 1] as const

  // Build the line connecting only points with values; gaps for null months
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  data.forEach((d, i) => {
    if (d.ageDays === null) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
    } else {
      current.push({ x: xToPx(i), y: yToPx(d.ageDays) })
    }
  })
  if (current.length > 0) segments.push(current)

  const lineColor = '#3DDC97'
  const fillId = 'aom-fill'

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label="Edad del dinero por mes"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
          <stop offset="60%" stopColor={lineColor} stopOpacity="0.10" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

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
              {Math.round(v)}d
            </text>
          </g>
        )
      })}

      {/* X axis */}
      <line
        x1={padding.left}
        x2={totalWidth - padding.right}
        y1={padding.top + chartHeight}
        y2={padding.top + chartHeight}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1"
      />

      {/* Areas under each segment */}
      {segments.map((seg, idx) => {
        if (seg.length === 0) return null
        const baseY = padding.top + chartHeight
        const path =
          `M ${seg[0].x},${baseY} ` +
          seg.map((p) => `L ${p.x},${p.y}`).join(' ') +
          ` L ${seg[seg.length - 1].x},${baseY} Z`
        return <path key={`area-${idx}`} d={path} fill={`url(#${fillId})`} />
      })}

      {/* Lines */}
      {segments.map((seg, idx) => {
        if (seg.length < 2) return null
        const path = `M ${seg.map((p) => `${p.x},${p.y}`).join(' L ')}`
        return (
          <path
            key={`line-${idx}`}
            d={path}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}

      {/* Dots */}
      {data.map((d, i) => {
        if (d.ageDays === null) return null
        return (
          <circle
            key={`dot-${i}`}
            cx={xToPx(i)}
            cy={yToPx(d.ageDays)}
            r="3.5"
            fill="#0B0B0C"
            stroke={lineColor}
            strokeWidth="2"
          >
            <title>
              {d.label}: {Math.round(d.ageDays)} días
            </title>
          </circle>
        )
      })}

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
