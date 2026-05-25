import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from './IconButton'

// Chrome compartido para headers de modal. Antes el patrón
// `<header className="px-6 pt-5 pb-4 border-b ... flex items-start
// justify-between gap-4">` con su botón X de cierre vivía duplicado
// en 12+ modales. Cuando había que cambiar el padding o el ring del
// X, había que tocar los 12.
//
// La división en dos piezas (ModalHeader = chrome + X, ModalTitle =
// eyebrow + h2) permite headers más complejos (icono al lado, badges,
// subtítulos) sin volver a un componente con 10 props.

interface ModalHeaderProps {
  onClose: () => void
  closeAriaLabel?: string
  /** Extra classes (ej. `sticky top-0 bg-[var(--s1)] z-10` para
   *  modales largos donde el header debe quedar fijo). */
  className?: string
  children: ReactNode
}

export function ModalHeader({
  onClose,
  closeAriaLabel = 'Cerrar',
  className = '',
  children,
}: ModalHeaderProps) {
  return (
    <header
      className={`px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4 ${className}`}
    >
      {children}
      <IconButton
        onClick={onClose}
        aria-label={closeAriaLabel}
        className="shrink-0"
      >
        <X size={18} strokeWidth={2.2} />
      </IconButton>
    </header>
  )
}

// ModalFooter: barra inferior con botones (Cancelar/Guardar/Eliminar).
// Patrón duplicado en 10 modales con misma estructura (px-6 py-4
// border-t + flex justify-end + bg overlay).

interface ModalFooterProps {
  /** Gap entre botones. `md` (gap-3, default) o `sm` (gap-2) para
   *  footers densos como ConfirmDialog. */
  gap?: 'sm' | 'md'
  className?: string
  children: ReactNode
}

export function ModalFooter({
  gap = 'md',
  className = '',
  children,
}: ModalFooterProps) {
  return (
    <footer
      className={`px-6 py-4 border-t border-[var(--border)] flex items-center justify-end ${
        gap === 'sm' ? 'gap-2' : 'gap-3'
      } bg-[var(--overlay-1)] ${className}`}
    >
      {children}
    </footer>
  )
}

interface ModalTitleProps {
  eyebrow?: ReactNode
  id?: string
  description?: ReactNode
  /** `default` = text-[20px], `compact` = text-[18px] para títulos
   *  largos donde 20px envolvería. */
  size?: 'default' | 'compact'
  children: ReactNode
}

export function ModalTitle({
  eyebrow,
  id,
  description,
  size = 'default',
  children,
}: ModalTitleProps) {
  const titleSize = size === 'compact' ? 'text-[18px]' : 'text-[20px]'
  return (
    <div className="min-w-0">
      {eyebrow && (
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
          {eyebrow}
        </div>
      )}
      <h2
        id={id}
        className={`${titleSize} font-bold leading-tight tracking-tight ${
          eyebrow ? 'mt-1' : ''
        }`}
      >
        {children}
      </h2>
      {description && (
        <div className="text-[12px] text-[var(--muted)] mt-1">
          {description}
        </div>
      )}
    </div>
  )
}
