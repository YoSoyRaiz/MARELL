'use client'

import { useRef, type ReactNode, type MouseEvent } from 'react'

interface Props {
  children: ReactNode
  className?: string
  /** Tailwind border / bg classes for the wrapper (let callers pick the visual). */
  surface?: string
  /** Force the gradient hue. Defaults to brand green. */
  hue?: 'green' | 'teal'
  /** When true, the inner content has rounded-[inherit]. */
  inner?: boolean
}

/**
 * Card wrapper that paints a soft radial gradient under the cursor on hover.
 * The position is tracked via CSS variables (no re-renders) and faded out on
 * mouse leave. Used across landing sections to add a subtle premium feel.
 */
export function InteractiveCard({
  children,
  className = '',
  surface = 'rounded-[28px] landing-card',
  hue = 'green',
  inner = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
    el.style.setProperty('--lc-opacity', '1')
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--lc-opacity', '0')
  }

  const tint =
    hue === 'teal'
      ? 'rgba(46,196,182,.18), transparent 38%'
      : 'rgba(61,220,151,.16), transparent 40%'

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden ${surface} ${className}`}
      style={
        {
          '--mx': '50%',
          '--my': '50%',
          '--lc-opacity': '0',
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at var(--mx) var(--my), ${tint})`,
          opacity: 'var(--lc-opacity)',
          borderRadius: inner ? 'inherit' : undefined,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
