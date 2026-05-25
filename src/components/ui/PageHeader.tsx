import type { ReactNode } from 'react'

// PageHeader: encabezado estándar de página (eyebrow + h1 + description).
//
// Antes el patrón vivía duplicado en 20+ páginas:
//   <div className="space-y-2">
//     <div className="text-eyebrow font-semibold uppercase ...">{eyebrow}</div>
//     <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] ...">{title}</h1>
//     <p className="text-[var(--text2)] text-body ...">{description}</p>
//   </div>
//
// El title puede contener spans con gradient-text, así que va como children.

interface PageHeaderProps {
  eyebrow: string
  description?: ReactNode
  /** El description default es text-body; algunas páginas (como
   *  Plan vacío o Resumen sin presupuesto) usan text-[16px] para más
   *  énfasis. */
  descriptionSize?: 'sm' | 'md'
  /** Default `max-w-xl` en el description. `none` para casos donde
   *  no queremos restringir el ancho. */
  descriptionWidth?: 'xl' | '2xl' | 'none'
  /** Children es el contenido del h1 — puede incluir spans con
   *  className="gradient-text". */
  children: ReactNode
}

export function PageHeader({
  eyebrow,
  description,
  descriptionSize = 'sm',
  descriptionWidth = 'xl',
  children,
}: PageHeaderProps) {
  const descriptionTextSize =
    descriptionSize === 'md' ? 'text-[16px]' : 'text-body'
  const descriptionMaxWidth =
    descriptionWidth === 'none'
      ? ''
      : descriptionWidth === '2xl'
        ? 'max-w-2xl'
        : 'max-w-xl'

  return (
    <div className="space-y-2">
      <div className="text-eyebrow font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {eyebrow}
      </div>
      <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
        {children}
      </h1>
      {description && (
        <p
          className={`text-[var(--text2)] leading-relaxed ${descriptionTextSize} ${descriptionMaxWidth}`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
