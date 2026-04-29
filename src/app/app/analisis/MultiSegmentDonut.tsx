interface Segment {
  value: number
  color: string
}

interface MultiSegmentDonutProps {
  segments: Segment[]
  size?: number
  stroke?: number
}

// SVG donut chart that renders multiple proportional segments around the
// circumference. Used by /app/analisis to visualize spending breakdown.
export function MultiSegmentDonut({
  segments,
  size = 180,
  stroke = 22,
}: MultiSegmentDonutProps) {
  const radius = size / 2
  const r = radius - stroke / 2
  const circumference = r * 2 * Math.PI
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      role="img"
      aria-label="Donut de distribución"
    >
      <circle
        cx={radius}
        cy={radius}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={stroke}
      />
      {total > 0 &&
        segments.reduce<{ acc: number; nodes: React.ReactNode[] }>(
          (state, seg, i) => {
            const value = Math.max(0, seg.value)
            if (value === 0) return state
            const pct = value / total
            // Tiny gap so adjacent segments don't visually merge
            const gap = segments.length > 1 ? 1 : 0
            const lengthPx = Math.max(0, pct * circumference - gap)
            const offset = -state.acc * circumference
            state.nodes.push(
              <circle
                key={i}
                cx={radius}
                cy={radius}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`${lengthPx} ${circumference}`}
                strokeDashoffset={offset}
                style={{
                  transition:
                    'stroke-dasharray .5s cubic-bezier(.25,.46,.45,.94), stroke-dashoffset .5s cubic-bezier(.25,.46,.45,.94)',
                }}
              />,
            )
            state.acc += pct
            return state
          },
          { acc: 0, nodes: [] },
        ).nodes}
    </svg>
  )
}
