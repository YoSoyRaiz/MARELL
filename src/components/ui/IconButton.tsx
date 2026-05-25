'use client'

import type { ComponentProps, ReactNode } from 'react'

// IconButton: botón cuadrado solo-icono con hover/active states.
//
// Es distinto a IconBadge (que es decorativo). Este lo usan los
// botones de cerrar modal (X), botones de menú, botones de
// eliminar en listas, navegación de mes (chevrons), etc.
//
// Antes el patrón vivía duplicado:
//   <button className="w-X h-X rounded-lg text-[var(--text2)]
//     hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex
//     items-center justify-center transition-colors ...">
// con variaciones de tamaño y tono (~15 sitios).

type Size = 'sm' | 'md' | 'lg'
type Tone = 'neutral' | 'danger'

const sizeClasses: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
}

const toneClasses: Record<Tone, string> = {
  neutral:
    'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)]',
  danger:
    'text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)]',
}

interface IconButtonProps
  extends Omit<ComponentProps<'button'>, 'children' | 'className'> {
  size?: Size
  tone?: Tone
  /** Use `inline-flex` en vez de `flex` cuando el botón vive dentro
   *  de un span/inline context. Default `flex`. */
  inline?: boolean
  className?: string
  children: ReactNode
}

export function IconButton({
  size = 'md',
  tone = 'neutral',
  inline = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`${sizeClasses[size]} rounded-lg ${
        inline ? 'inline-flex' : 'flex'
      } items-center justify-center transition-colors ${toneClasses[tone]} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  )
}
