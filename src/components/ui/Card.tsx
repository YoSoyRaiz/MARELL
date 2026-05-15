import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type Variant = 'default' | 'elevated' | 'glass' | 'gradient-border'

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

export function Card({
  variant = 'default',
  hover = false,
  className = '',
  children,
  ...rest
}: ComponentPropsWithoutRef<'div'> & {
  variant?: Variant
  hover?: boolean
  children: ReactNode
}) {
  const hoverClass = hover ? 'card-hover cursor-pointer' : ''
  return (
    <div
      {...rest}
      className={`rounded-[20px] transition-[transform,border-color,box-shadow] duration-300 ${variantClasses[variant]} ${hoverClass} ${className}`}
    >
      {children}
    </div>
  )
}
