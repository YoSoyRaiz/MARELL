import type { ReactNode } from 'react'

// WizardHeading: h1 + descripción que repiten todos los pasos del
// onboarding. Antes duplicado en 13 steps con el mismo h1 (text-[26px]
// sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight)
// y la misma p (text-[var(--text2)] text-[17px] leading-relaxed
// max-w-md).
//
// Distinto a PageHeader (que vive en /app): el wizard usa fuentes
// más grandes y no tiene eyebrow.

interface WizardHeadingProps {
  /** Eyebrow opcional encima del h1 (ej. "Personalizar plan · paso
   *  1 de 3"). */
  eyebrow?: ReactNode
  /** Texto del h1, puede incluir <span className="gradient-text">. */
  children: ReactNode
  /** Descripción opcional debajo del h1. */
  description?: ReactNode
  /** Permite override del max-w del párrafo (default `max-w-md`).
   *  Step02 usa `max-w-lg` para descripciones largas. */
  descriptionMaxWidth?: 'md' | 'lg' | 'xl' | '2xl' | 'none'
}

export function WizardHeading({
  eyebrow,
  children,
  description,
  descriptionMaxWidth = 'md',
}: WizardHeadingProps) {
  const maxW =
    descriptionMaxWidth === 'none'
      ? ''
      : descriptionMaxWidth === 'lg'
        ? 'max-w-lg'
        : descriptionMaxWidth === 'xl'
          ? 'max-w-xl'
          : descriptionMaxWidth === '2xl'
            ? 'max-w-2xl'
            : 'max-w-md'
  return (
    <div className="space-y-3">
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand-text)] font-semibold">
          {eyebrow}
        </div>
      )}
      <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
        {children}
      </h1>
      {description && (
        <p
          className={`text-[var(--text2)] text-[17px] leading-relaxed ${maxW}`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
