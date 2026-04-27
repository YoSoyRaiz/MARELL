type Tone = 'green' | 'red' | 'amber' | 'violet'

const TONE: Record<Tone, { stroke: string; fill: string }> = {
  green:  { stroke: '#3DDC97', fill: 'rgba(61,220,151,.15)' },
  red:    { stroke: '#FF4F6A', fill: 'rgba(255,79,106,.15)' },
  amber:  { stroke: '#F5C842', fill: 'rgba(245,200,66,.15)' },
  violet: { stroke: '#A78BFA', fill: 'rgba(167,139,250,.15)' },
}

export function Sparkline({
  points,
  tone = 'green',
  width = 140,
  height = 40,
}: {
  points: number[]
  tone?: Tone
  width?: number
  height?: number
}) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = width / (points.length - 1)

  const coords = points.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return { x, y }
  })

  const linePath = coords
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`
  const colors = TONE[tone]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path d={areaPath} fill={colors.fill} />
      <path
        d={linePath}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
