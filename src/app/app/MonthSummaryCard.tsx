import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'
import Link from 'next/link'

interface MonthSummaryCardProps {
  monthLabel: string
  /** Net result of previous month (income − expenses). Acts as the
   *  "Disponible mes pasado" carry-over signal. Can be negative if the
   *  user overspent. */
  prevMonthNet: number
  totalIncome: number
  totalExpenses: number
  /** Total presupuestado a categorías este mes. Reemplaza la fila
   *  "Disponible para asignar" porque esa cifra ya vive en el TopBar
   *  como source-of-truth global — duplicarla aquí era ruido. */
  totalAssigned: number
  fmtMoney: (n: number) => string
}

/**
 * Right-rail card that mirrors the dashboard mockup's "Resumen de este
 * mes" panel: a stack of 4 numeric rows (Disponible mes pasado /
 * Ingresos / Gastos / Disponible para asignar) so the user sees at a
 * glance how the current month is composed without leaving Resumen.
 *
 * Lives ABOVE the donut in the right column so it answers "where am I
 * this month?" before the progress visualization.
 */
export function MonthSummaryCard({
  monthLabel,
  prevMonthNet,
  totalIncome,
  totalExpenses,
  totalAssigned,
  fmtMoney,
}: MonthSummaryCardProps) {
  // Color coding for "Disponible mes pasado" — negative carry-over (the
  // user overspent last month) shows in coral so it doesn't quietly
  // blend with the rest.
  const prevNetTone =
    prevMonthNet < -0.005
      ? 'text-[var(--coral-text)]'
      : prevMonthNet > 0.005
        ? 'text-[var(--brand-text)]'
        : 'text-[var(--text2)]'

  return (
    <Card as="section" className="overflow-hidden">
      <CardHeader>
        <div className="min-w-0">
          <h2 className="text-body font-semibold text-[var(--text)] truncate">
            Resumen de {monthLabel}
          </h2>
          <p className="text-eyebrow text-[var(--muted)] mt-0.5">
            Cómo se compone tu mes
          </p>
        </div>
        <Link
          href="/app/plan"
          className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0"
        >
          Plan
          <ArrowRight size={12} strokeWidth={2.4} />
        </Link>
      </CardHeader>
      <ul className="divide-y divide-[var(--border)]">
        <Row
          label="Disponible mes pasado"
          hint="Lo que quedó al cerrar el mes anterior"
          value={fmtMoney(prevMonthNet)}
          tone={prevNetTone}
        />
        <Row
          label="Ingresos"
          value={fmtMoney(totalIncome)}
          tone="text-[var(--brand-text)]"
        />
        <Row
          label="Gastos"
          value={`−${fmtMoney(totalExpenses)}`}
          tone="text-[var(--coral-text)]"
        />
        <Row
          label="Asignado este mes"
          hint="Lo que ya tiene un trabajo asignado"
          value={fmtMoney(totalAssigned)}
          tone="text-[var(--text)]"
          bold
        />
      </ul>
    </Card>
  )
}

function Row({
  label,
  hint,
  value,
  tone,
  bold,
}: {
  label: string
  hint?: string
  value: string
  tone: string
  bold?: boolean
}) {
  return (
    <li className="px-5 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div
          className={`text-body-sm ${
            bold
              ? 'font-semibold text-[var(--text)]'
              : 'text-[var(--text2)]'
          }`}
        >
          {label}
        </div>
        {hint && (
          <div className="text-tiny text-[var(--muted2)] mt-0.5 leading-snug">
            {hint}
          </div>
        )}
      </div>
      <div
        className={`text-body tabular-nums num shrink-0 ${
          bold ? 'font-bold' : 'font-semibold'
        } ${tone}`}
      >
        {value}
      </div>
    </li>
  )
}
