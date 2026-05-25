'use client'

import { useEffect, type ReactNode } from 'react'

// Modal compartido: scrim + dialog chrome + ESC + scroll-lock.
//
// Antes cada modal duplicaba en su useEffect el handler de Escape y
// el `document.body.style.overflow = 'hidden'`, además del scrim
// (`absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm`) y el
// wrapper `fixed inset-0 z-50 ...`. ~80 LOC repetidas × 14 modales.
// Ahora todo vive aquí.

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** ID del h2 que da nombre al modal — para aria-labelledby. */
  ariaLabelledBy?: string
  /** `bottom-sheet`: pegado al fondo en mobile, centrado en desktop
   *  (default — patrón de form modals). `center`: centrado en todos
   *  los breakpoints (para alerts/confirmaciones cortas). */
  variant?: 'bottom-sheet' | 'center'
  /** Max-width del dialog. Mapea a Tailwind max-w-*. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Max-height del dialog (default '90vh'). Algunos modales necesitan
   *  '92vh' o '85vh' según el contenido — el caller decide. */
  maxHeight?: string
  /** Si true, el body usará overflow-y-auto en lugar de flex flex-col.
   *  Útil cuando todo el contenido cabe scrolleable sin footer fijo. */
  scrollable?: boolean
  children: ReactNode
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const

export function Modal({
  isOpen,
  onClose,
  ariaLabelledBy,
  variant = 'bottom-sheet',
  size = 'md',
  maxHeight = '90vh',
  scrollable = false,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const wrapperClass =
    variant === 'bottom-sheet'
      ? 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center p-4'

  const dialogShape =
    variant === 'bottom-sheet'
      ? 'rounded-t-3xl sm:rounded-2xl pb-[env(safe-area-inset-bottom)] sm:pb-0 shadow-[0_-24px_64px_rgba(0,0,0,0.6)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.6)]'
      : 'rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)]'

  const dialogLayout = scrollable ? 'overflow-y-auto' : 'flex flex-col'

  return (
    <div className={wrapperClass}>
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        style={{ maxHeight }}
        className={`relative w-full ${sizeMap[size]} ${dialogLayout} ${dialogShape} border border-[var(--border2)] bg-[var(--s1)] animate-step`}
      >
        {children}
      </div>
    </div>
  )
}
