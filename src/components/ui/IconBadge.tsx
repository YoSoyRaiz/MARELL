import type { ReactNode } from 'react'

// Badge cuadrado para iconos. Patrón estático (no-interactivo) que
// vivía duplicado como `w-X h-X rounded-lg bg-... text-... flex
// items-center justify-center` en 20+ lugares (KPI cards, list rows,
// section headers).
//
// IMPORTANTE: este NO es para botones — los icon-only buttons llevan
// hover/active states y deben quedar inline o usar Button con icono.
// Este componente es solo para badges decorativos.

type Size = 'sm' | 'md' | 'lg'
type Tone = 'neutral' | 'brand' | 'coral' | 'info' | 'warn'

const sizeClasses: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--overlay-1)] text-[var(--text2)]',
  brand: 'bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)]',
  coral: 'bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)]',
  info: 'bg-[rgba(77,168,255,0.10)] text-[var(--info-text)]',
  warn: 'bg-[rgba(245,200,66,0.10)] text-[var(--warn-text)]',
}

interface IconBadgeProps {
  size?: Size
  /** Preset de color. Para tonos custom no listados aquí, pasar
   *  `tone="neutral"` (o ninguno) y usar className para override. */
  tone?: Tone
  /** Por defecto true — la mayoría de uso (icon en flex row) lo
   *  necesita. Pasar false para casos donde el badge debe crecer. */
  shrink?: boolean
  className?: string
  children: ReactNode
}

export function IconBadge({
  size = 'md',
  tone = 'neutral',
  shrink = true,
  className = '',
  children,
}: IconBadgeProps) {
  return (
    <div
      className={`rounded-lg flex items-center justify-center ${
        sizeClasses[size]
      } ${toneClasses[tone]} ${shrink ? 'shrink-0' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
