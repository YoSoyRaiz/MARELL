import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// EmptyState compartido. Reemplaza el componente local
// `ReportEmptyState` que vivía en analisis/ (sin CTA slot), y
// también el patrón inline que vivía duplicado en Cuentas, Metas,
// Transacciones, Programadas (con CTA).
//
// Variantes:
// - `padding="lg"` (default, p-12): full-page empty state
// - `padding="md"` (p-10): empty resultado de filtro (más
//   compacto, sin icono ni CTA por convención)
//
// El `action` es opcional — algunas pantallas (reportes) muestran
// el empty state sin CTA porque dependen del onboarding.

interface EmptyStateProps {
  Icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  padding?: 'md' | 'lg'
}

export function EmptyState({
  Icon,
  title,
  description,
  action,
  padding = 'lg',
}: EmptyStateProps) {
  const pad = padding === 'md' ? 'p-10' : 'p-12'
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--s1)] ${pad} text-center space-y-4`}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--overlay-1)] flex items-center justify-center mx-auto text-[var(--text2)]">
          <Icon size={22} strokeWidth={2} />
        </div>
      )}
      <div className="text-[16px] text-[var(--text)] font-semibold">
        {title}
      </div>
      {description && (
        <p className="text-body-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
