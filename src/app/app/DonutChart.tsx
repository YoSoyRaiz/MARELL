interface DonutChartProps {
  value: number
  total: number
  size?: number
  stroke?: number
}

export function DonutChart({ value, total, size = 140, stroke = 14 }: DonutChartProps) {
  const radius = size / 2
  const r = radius - stroke / 2
  const circumference = r * 2 * Math.PI
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0
  const offset = circumference - pct * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <defs>
        <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EC4B6" />
          <stop offset="50%" stopColor="#3DDC97" />
          <stop offset="100%" stopColor="#8AC926" />
        </linearGradient>
      </defs>
      <circle
        cx={radius}
        cy={radius}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      <circle
        cx={radius}
        cy={radius}
        r={r}
        fill="none"
        stroke="url(#donut-gradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.25,.46,.45,.94)' }}
      />
    </svg>
  )
}
