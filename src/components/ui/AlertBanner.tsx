import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

// AlertBanner: pill horizontal con icon + texto para errores,
// warnings, success messages. Antes vivía duplicado en 24 sitios
// (19 danger + 2 warn + 3 success), con dos tamaños inconsistentes
// (compact en modales, full en páginas).
//
// El icono se elige automáticamente por tone — AlertCircle para los
// estados "atención" (danger/warn) y CheckCircle2 para success.

type Tone = 'danger' | 'warn' | 'success'
type Size = 'sm' | 'md'

const toneStyles: Record<
  Tone,
  { border: string; bg: string; iconColor: string }
> = {
  danger: {
    border: 'border-[var(--coral)]/40',
    bg: 'bg-[rgba(255,122,89,0.06)]',
    iconColor: 'text-[var(--coral-text)]',
  },
  warn: {
    border: 'border-[var(--warn)]/40',
    bg: 'bg-[rgba(245,200,66,0.06)]',
    iconColor: 'text-[var(--warn-text)]',
  },
  success: {
    border: 'border-[var(--success)]/40',
    bg: 'bg-[rgba(61,220,151,0.06)]',
    iconColor: 'text-[var(--brand-text)]',
  },
}

const sizeStyles: Record<
  Size,
  { padding: string; text: string; gap: string; iconSize: number }
> = {
  sm: { padding: 'px-3 py-2', text: 'text-meta', gap: 'gap-2', iconSize: 14 },
  md: { padding: 'px-4 py-3', text: 'text-body-sm', gap: 'gap-3', iconSize: 16 },
}

interface AlertBannerProps {
  tone: Tone
  /** `sm` (px-3 py-2, text-12px) para inline en modales o formularios
   *  estrechos. `md` (px-4 py-3, text-13px, default) para page-level. */
  size?: Size
  className?: string
  children: ReactNode
}

export function AlertBanner({
  tone,
  size = 'md',
  className = '',
  children,
}: AlertBannerProps) {
  const t = toneStyles[tone]
  const s = sizeStyles[size]
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      className={`rounded-xl border ${t.border} ${t.bg} ${s.padding} ${s.text} flex items-start ${s.gap} text-[var(--text)] ${className}`}
    >
      <Icon
        size={s.iconSize}
        strokeWidth={2.2}
        className={`${t.iconColor} shrink-0 mt-0.5`}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
