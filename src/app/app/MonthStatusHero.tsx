'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Target,
  Calendar,
} from 'lucide-react'
import { useReadyToAssign } from './ReadyToAssignProvider'
import { useFormatMoney } from './CurrencyProvider'
import { AnimatedNumber } from './plan/AnimatedNumber'

interface MonthStatusHeroProps {
  /** Categories with negative available this month (lifetime
   *  balance < 0). High = friction, the user has to fix something. */
  overspentCount: number
  /** Categories with goals that aren't met yet this month. */
  undermetGoalsCount: number
  /** Scheduled transactions firing in the next 14 days. */
  upcomingCount: number
  /** Initial readyToAssign value used during SSR — the live one comes
   *  from ReadyToAssignProvider. */
  readyToAssignFallback: number
}

/**
 * Single focused hero card that replaces the old 4-KPI grid (Ingresos
 * / Gastos / Ahorros / Patrimonio). Those numbers were passive; users
 * couldn't act on them. This card surfaces what matters TODAY:
 *
 *   1. How much money still needs a job (ReadyToAssign).
 *   2. Health chips: overspent categories, undermet goals, upcoming
 *      programmed payments.
 *   3. A direct CTA to /app/plan when there's friction to resolve.
 *
 * Detailed totals (income, expenses, net worth) move to /app/analisis
 * where they belong.
 */
export function MonthStatusHero({
  overspentCount,
  undermetGoalsCount,
  upcomingCount,
  readyToAssignFallback,
}: MonthStatusHeroProps) {
  const ctx = useReadyToAssign()
  const readyToAssign = ctx?.readyToAssign ?? readyToAssignFallback
  const fmtMoney = useFormatMoney()

  const isPositive = readyToAssign > 0.005
  const isNegative = readyToAssign < -0.005
  const isZero = !isPositive && !isNegative

  const headline = isNegative
    ? 'Asignaste de más. Reduce alguna categoría.'
    : isPositive
      ? 'Dinero esperando un trabajo.'
      : 'Cada peso tiene su trabajo.'

  const tone = isNegative ? 'coral' : isPositive ? 'brand' : 'neutral'

  // The hero is the most prominent surface on the dashboard. Use a
  // solid surface (--s1) so it stays clearly delimited from the page
  // bg in both themes — the soft tinted gradients we tried first
  // disappeared in light mode and made the card boundary fuzzy.
  const borderColor =
    tone === 'coral'
      ? 'border-[var(--coral)]/45'
      : tone === 'brand'
        ? 'border-[var(--brand-2)]/40'
        : 'border-[var(--border2)]'
  const bgGradient = 'bg-[var(--s1)]'
  // Big numbers use *-text variants so green stays readable in light
  // mode (darkened stops) without losing the gradient feel in dark.
  const valueColor =
    tone === 'coral'
      ? 'text-[var(--coral-text)]'
      : tone === 'brand'
        ? 'gradient-text'
        : 'text-[var(--text2)]'

  return (
    <section
      aria-label="Estado del mes"
      className={`rounded-2xl border ${borderColor} ${bgGradient} px-5 py-5 sm:px-6 sm:py-6`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              tone === 'coral'
                ? 'text-[var(--coral-text)]'
                : 'text-[var(--brand-text)]'
            }`}
          >
            Por asignar
          </div>
          <AnimatedNumber
            value={readyToAssign}
            format={fmtMoney}
            className={`block mt-2 text-[36px] sm:text-[44px] lg:text-[52px] font-bold leading-[1] tabular-nums num tracking-tight ${valueColor}`}
          />
          <p className="mt-2 text-[13px] sm:text-[14px] text-[var(--text2)] leading-relaxed">
            {headline}
          </p>
        </div>

        {(isPositive || isNegative) && (
          <Link
            href="/app/plan"
            className="shrink-0 h-10 px-4 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-1.5 transition-[filter]"
          >
            {isNegative ? 'Reducir asignaciones' : 'Asignar dinero'}
            <ArrowRight size={12} strokeWidth={2.4} />
          </Link>
        )}
        {isZero && (
          <span className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.06)] text-[var(--brand-2)] text-[12px] font-semibold uppercase tracking-[0.12em]">
            <CheckCircle2 size={14} strokeWidth={2.4} />
            En cero
          </span>
        )}
      </div>

      {/* Status chips — small, glanceable, link to the relevant page
          when the count > 0. */}
      <div className="mt-5 flex flex-wrap gap-2">
        <StatusChip
          tone={overspentCount > 0 ? 'coral' : 'success'}
          label={
            overspentCount > 0
              ? `${overspentCount} sobregirada${overspentCount === 1 ? '' : 's'}`
              : 'Sin sobregiros'
          }
          Icon={AlertCircle}
          href={overspentCount > 0 ? '/app/plan' : undefined}
        />
        <StatusChip
          tone={undermetGoalsCount > 0 ? 'warn' : 'success'}
          label={
            undermetGoalsCount > 0
              ? `${undermetGoalsCount} meta${undermetGoalsCount === 1 ? '' : 's'} pendiente${undermetGoalsCount === 1 ? '' : 's'}`
              : 'Metas al día'
          }
          Icon={Target}
          href={undermetGoalsCount > 0 ? '/app/metas' : undefined}
        />
        <StatusChip
          tone="neutral"
          label={
            upcomingCount > 0
              ? `${upcomingCount} próxima${upcomingCount === 1 ? '' : 's'} en 14 días`
              : 'Sin programadas próximas'
          }
          Icon={Calendar}
          href={upcomingCount > 0 ? '/app/programadas' : undefined}
        />
      </div>
    </section>
  )
}

interface StatusChipProps {
  tone: 'success' | 'warn' | 'coral' | 'neutral'
  label: string
  Icon: typeof CheckCircle2
  href?: string
}

function StatusChip({ tone, label, Icon, href }: StatusChipProps) {
  // Chips use the *-text shades so labels stay readable on light bg.
  // The bg tints are bumped slightly so the chip surface still reads
  // as "branded" against paper white (it'd disappear at 6% on white).
  const palette = {
    success:
      'border-[var(--brand-2)]/35 bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)]',
    warn:
      'border-[var(--warn)]/40 bg-[rgba(245,200,66,0.10)] text-[var(--warn-text)]',
    coral:
      'border-[var(--coral)]/45 bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)]',
    neutral:
      'border-[var(--border2)] bg-[var(--overlay-1)] text-[var(--text2)]',
  }[tone]

  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border ${palette} text-[12px] font-medium`}
    >
      <Icon size={12} strokeWidth={2.4} />
      {label}
    </span>
  )

  if (!href) return inner
  return (
    <Link
      href={href}
      className="hover:brightness-110 active:scale-[.98] transition-[filter,transform]"
    >
      {inner}
    </Link>
  )
}
