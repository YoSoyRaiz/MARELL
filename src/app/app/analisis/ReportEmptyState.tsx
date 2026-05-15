import type { LucideIcon } from 'lucide-react'

interface ReportEmptyStateProps {
  Icon: LucideIcon
  title: string
  description: string
}

/**
 * Shared empty-state card used across the 5 Reflect reports
 * (Spending Breakdown, Trends, Net Worth, Income vs Expense,
 * Age of Money). Antes cada reporte tenía su propio bloque
 * inline — el patrón era idéntico salvo el ícono y la copy.
 * Centralizado para mantener consistencia visual y poder
 * tocar el estilo en un solo sitio.
 */
export function ReportEmptyState({
  Icon,
  title,
  description,
}: ReportEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-[var(--overlay-1)] flex items-center justify-center mx-auto text-[var(--text2)]">
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="text-[16px] text-[var(--text)] font-semibold">
        {title}
      </div>
      <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  )
}
