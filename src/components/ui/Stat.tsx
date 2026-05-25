import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from './Card'

// Stat: KPI card con icon + label + value (+ sub opcional).
//
// Antes 6 archivos definían localmente su propio `KpiCard` /
// `StatCard` / `ForecastCard` con la misma estructura: Card +
// IconBadge-style + label uppercase + valor grande tabular.
// Diferencias mínimas (text-20 vs text-22, sub opcional, tone
// override del valor).
//
// Centralizado para mantener una sola fuente de verdad y no tener
// 6 componentes locales de la misma cosa.

interface StatProps {
  label: string
  /** Texto del valor. ReactNode para permitir spans con `gradient-text`
   *  o `tabular-nums` markup adicional. */
  value: ReactNode
  /** Texto secundario debajo del valor (ej. "vs mes pasado"). */
  sub?: ReactNode
  Icon?: LucideIcon
  /** Background del badge del ícono. Default `bg-[var(--overlay-1)]`. */
  iconBg?: string
  /** Color del ícono. Default `text-[var(--text2)]`. */
  iconColor?: string
  /** Override del color del valor (ej. `gradient-text` o
   *  `text-coral-text`). Default `text-[var(--text)]`. */
  valueClass?: string
  /** Tamaño del valor. `md` (20px, default) o `lg` (22px). */
  size?: 'md' | 'lg'
}

export function Stat({
  label,
  value,
  sub,
  Icon,
  iconBg = 'bg-[var(--overlay-1)]',
  iconColor = 'text-[var(--text2)]',
  valueClass = 'text-[var(--text)]',
  size = 'md',
}: StatProps) {
  const valueSize = size === 'lg' ? 'text-[22px]' : 'text-[20px]'
  return (
    <Card padding="md">
      {Icon && (
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
        </div>
      )}
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
        {label}
      </div>
      <div className={`${valueSize} font-bold tabular-nums num leading-none ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[var(--muted)] mt-1 num tabular-nums">
          {sub}
        </div>
      )}
    </Card>
  )
}
