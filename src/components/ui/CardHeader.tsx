import type { ReactNode } from 'react'

// CardHeader: header con borde inferior para Card de tipo "section"
// (list-section cards con header + body). Antes este patrón vivía
// en cada Card consumidor:
//   <header className="px-5 py-4 border-b border-[var(--border)]
//        flex items-center justify-between gap-3">
//     <h2>...</h2>
//     <Link>...</Link>
//   </header>
//
// Repetido en 9+ list sections.

interface CardHeaderProps {
  /** `center` (default) alinea verticalmente al medio.
   *  `start` para títulos con descripción debajo. */
  align?: 'center' | 'start'
  /** Gap entre elementos. Default `gap-3`. */
  gap?: 'none' | 'sm' | 'md'
  className?: string
  children: ReactNode
}

export function CardHeader({
  align = 'center',
  gap = 'md',
  className = '',
  children,
}: CardHeaderProps) {
  const alignClass = align === 'start' ? 'items-start' : 'items-center'
  const gapClass = gap === 'none' ? '' : gap === 'sm' ? 'gap-2' : 'gap-3'
  return (
    <header
      className={`px-5 py-4 border-b border-[var(--border)] flex ${alignClass} justify-between ${gapClass} ${className}`}
    >
      {children}
    </header>
  )
}
