import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

type Variant = 'gradient' | 'outline' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'tight'

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-[10px]',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-[52px] px-7 text-[15px] rounded-2xl',
  // `tight` matches the in-modal footer buttons (Cancelar/Guardar)
  // que estaban duplicados inline en 15+ archivos antes de
  // la consolidación. Pixel-equivalent al primary CTA inline:
  // h-10, px-5, text-[13px], rounded-xl.
  tight: 'h-10 px-5 text-[13px] rounded-xl',
}

const variantClasses: Record<Variant, string> = {
  gradient:
    'gradient-bg text-[#0B0B0C] font-semibold glow-on-hover hover:brightness-105 active:brightness-95',
  outline:
    'bg-transparent text-[var(--text)] font-medium border border-[var(--border3)] hover:border-[var(--brand-2)]/50 hover:bg-[var(--overlay-2)]',
  ghost:
    'bg-transparent text-[var(--text2)] font-medium hover:text-[var(--text)] hover:bg-[var(--overlay-2)]',
  subtle:
    'bg-[var(--overlay-2)] text-[var(--text)] font-medium border border-[var(--border)] hover:bg-[var(--overlay-3)] hover:border-[var(--border3)]',
  danger:
    'bg-[var(--coral)] text-[#0B0B0C] font-semibold hover:brightness-110 active:brightness-95',
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 transition-[background,color,border-color,filter,box-shadow,transform] duration-200 ease-out select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:opacity-40 disabled:pointer-events-none active:scale-[.98]'

type CommonProps = {
  variant?: Variant
  size?: Size
  iconLeft?: ReactNode
  iconRight?: ReactNode
  className?: string
  children: ReactNode
}

// ComponentProps (no -WithoutRef) incluye `ref` como prop — necesario
// para que React 19 lo forwardée al <button> nativo. ConfirmDialog usa
// confirmBtnRef para enfocar el botón cuando se abre el dialog.
type ButtonAsButton = CommonProps &
  Omit<ComponentProps<'button'>, keyof CommonProps> & { href?: never }

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, keyof CommonProps | 'href'> & { href: string }

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = 'gradient',
    size = 'md',
    iconLeft,
    iconRight,
    className = '',
    children,
    ...rest
  } = props as CommonProps & { href?: string }

  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`

  const inner = (
    <>
      {iconLeft && <span className="-ml-0.5 inline-flex">{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span className="-mr-0.5 inline-flex">{iconRight}</span>}
    </>
  )

  if ('href' in props && props.href) {
    return (
      <Link {...(rest as ComponentProps<typeof Link>)} href={props.href} className={classes}>
        {inner}
      </Link>
    )
  }

  return (
    <button {...(rest as ComponentProps<'button'>)} className={classes}>
      {inner}
    </button>
  )
}
