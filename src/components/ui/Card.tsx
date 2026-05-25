import type { ComponentProps, ReactNode } from 'react'

type Variant = 'default' | 'elevated' | 'glass' | 'gradient-border'

// Padding presets que cubren los patrones inline duplicados en
// 30+ lugares: `p-5` (md), `px-5 py-4` (sm). Para layouts custom
// (con secciones internas que llevan su propio padding) usar
// padding='none' y aplicar overflow/clases extra vía className.
type Padding = 'none' | 'sm' | 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  default:
    'bg-[var(--s1)] border border-[var(--border)]',
  elevated:
    'bg-[var(--s1)] border border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,.4),0_4px_16px_rgba(0,0,0,.3)]',
  glass:
    'bg-[var(--overlay-1)] border border-[var(--border2)] backdrop-blur-xl',
  'gradient-border':
    'gradient-border',
}

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'px-5 py-4',
  md: 'p-5',
  lg: 'p-6',
}

interface CardProps extends Omit<ComponentProps<'div'>, 'children'> {
  variant?: Variant
  padding?: Padding
  hover?: boolean
  children: ReactNode
}

export function Card({
  variant = 'default',
  padding = 'none',
  hover = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  const hoverClass = hover ? 'card-hover cursor-pointer' : ''
  return (
    <div
      {...rest}
      className={`rounded-2xl transition-[transform,border-color,box-shadow] duration-300 ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClass} ${className}`}
    >
      {children}
    </div>
  )
}
