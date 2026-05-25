'use client'

import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Sparkles,
  TrendingDown,
  Target,
  Flame,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useFormatMoney, useFormatMoneyShort } from './CurrencyProvider'

export type InsightSeverity = 'critical' | 'warn' | 'info' | 'success'

export interface Insight {
  /** Stable key for React reconciliation. */
  id: string
  severity: InsightSeverity
  title: string
  message: string
  href?: string
  ctaLabel?: string
  /** When set, the icon overrides the default for the severity. */
  icon?: 'alert' | 'flame' | 'target' | 'trend-down' | 'sparkles'
}

export interface InsightInputs {
  readyToAssign: number
  totalAssignedThisMonth: number
  overspentCount: number
  undermetGoalsCount: number
  topExpense: { name: string; amount: number } | null
  closestGoal: {
    name: string
    progress: number
    remaining: number
  } | null
  /** When the user is on pace to blow past a category's assignment
   *  before month-end, the page surfaces this as the most actionable
   *  insight. Linear projection of current spend rate. */
  projectedOverspend: {
    name: string
    assigned: number
    spent: number
    projected: number
  } | null
}

interface InsightsSectionProps {
  inputs: InsightInputs
}

const SEVERITY_TONES: Record<
  InsightSeverity,
  { border: string; bg: string; iconBg: string; iconColor: string; label: string }
> = {
  critical: {
    border: 'border-[var(--coral)]/40',
    bg: 'bg-[rgba(255,122,89,0.05)]',
    iconBg: 'bg-[rgba(255,122,89,0.14)]',
    iconColor: 'text-[var(--coral-text)]',
    label: 'text-[var(--coral-text)]',
  },
  warn: {
    border: 'border-[var(--warn)]/40',
    bg: 'bg-[rgba(245,200,66,0.05)]',
    iconBg: 'bg-[rgba(245,200,66,0.14)]',
    iconColor: 'text-[var(--warn-text)]',
    label: 'text-[var(--warn-text)]',
  },
  info: {
    border: 'border-[var(--info)]/40',
    bg: 'bg-[rgba(77,168,255,0.05)]',
    iconBg: 'bg-[rgba(77,168,255,0.14)]',
    iconColor: 'text-[var(--info-text)]',
    label: 'text-[var(--info-text)]',
  },
  success: {
    border: 'border-[var(--brand-2)]/40',
    bg: 'bg-[rgba(61,220,151,0.04)]',
    iconBg: 'bg-[rgba(61,220,151,0.14)]',
    iconColor: 'text-[var(--brand-text)]',
    label: 'text-[var(--brand-text)]',
  },
}

const ICON_MAP: Record<NonNullable<Insight['icon']>, LucideIcon> = {
  alert: AlertCircle,
  flame: Flame,
  target: Target,
  'trend-down': TrendingDown,
  sparkles: Sparkles,
}

const DEFAULT_ICON_FOR_SEVERITY: Record<InsightSeverity, LucideIcon> = {
  critical: AlertCircle,
  warn: AlertCircle,
  info: Sparkles,
  success: Sparkles,
}

export function InsightsSection({ inputs }: InsightsSectionProps) {
  const fmtMoney = useFormatMoney()
  const fmtMoneyShort = useFormatMoneyShort()
  const insights = buildInsights({ ...inputs, fmtMoney, fmtMoneyShort })
  if (insights.length === 0) return null

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 space-y-3">
      <div className="flex items-center gap-2 pb-[10px]">
        <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-[#0B0B0C]">
          <Sparkles size={12} strokeWidth={2.4} />
        </div>
        <div className="text-meta uppercase tracking-[0.18em] text-[var(--muted2)] font-semibold">
          Ideas para ti
        </div>
      </div>

      <div className="space-y-2.5">
        {insights.map((ins) => {
          const tone = SEVERITY_TONES[ins.severity]
          const Icon = ins.icon
            ? ICON_MAP[ins.icon]
            : DEFAULT_ICON_FOR_SEVERITY[ins.severity]
          return (
            <div
              key={ins.id}
              className={`rounded-xl border ${tone.border} ${tone.bg} px-3.5 py-3 flex items-start gap-3`}
            >
              <div
                className={`w-8 h-8 rounded-lg ${tone.iconBg} ${tone.iconColor} flex items-center justify-center shrink-0`}
              >
                <Icon size={14} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-meta font-semibold ${tone.label}`}>
                  {ins.title}
                </div>
                <div className="text-meta text-[var(--text)] leading-relaxed mt-0.5">
                  {ins.message}
                </div>
                {ins.href && ins.ctaLabel && (
                  <Link
                    href={ins.href}
                    className="mt-2 inline-flex items-center gap-1 text-eyebrow font-semibold text-[var(--brand-text)] hover:underline underline-offset-4"
                  >
                    {ins.ctaLabel}
                    <ArrowRight size={11} strokeWidth={2.4} />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function buildInsights(input: {
  readyToAssign: number
  totalAssignedThisMonth: number
  overspentCount: number
  undermetGoalsCount: number
  topExpense: { name: string; amount: number } | null
  closestGoal: {
    name: string
    progress: number
    remaining: number
  } | null
  projectedOverspend: {
    name: string
    assigned: number
    spent: number
    projected: number
  } | null
  fmtMoney: (n: number) => string
  fmtMoneyShort: (n: number) => string
}): Insight[] {
  const out: Insight[] = []
  const {
    readyToAssign,
    totalAssignedThisMonth,
    overspentCount,
    undermetGoalsCount,
    topExpense,
    closestGoal,
    projectedOverspend,
    fmtMoney,
    fmtMoneyShort,
  } = input

  // Predictive insight goes first — most actionable because the user
  // can still adjust spending or move money before month-end.
  if (projectedOverspend) {
    const overrun = Math.max(
      0,
      projectedOverspend.projected - projectedOverspend.assigned,
    )
    out.push({
      id: 'projected-overspend',
      severity: 'warn',
      title: `Vas en camino a exceder ${projectedOverspend.name}`,
      message: `Al ritmo actual gastarás ${fmtMoney(projectedOverspend.projected)} (${fmtMoney(overrun)} sobre lo asignado). Frena o mueve dinero desde otra categoría.`,
      href: '/app/plan',
      ctaLabel: 'Ajustar plan',
      icon: 'flame',
    })
  }

  if (readyToAssign < -0.005) {
    out.push({
      id: 'rta-neg',
      severity: 'critical',
      title: 'Asignaste de más',
      message: `Te pasaste por ${fmtMoney(Math.abs(readyToAssign))}. Reduce alguna categoría o mueve dinero entre ellas.`,
      href: '/app/plan',
      ctaLabel: 'Ir al plan',
      icon: 'alert',
    })
  }

  if (overspentCount > 0) {
    out.push({
      id: 'overspent',
      severity: 'warn',
      title:
        overspentCount === 1
          ? '1 categoría excedida'
          : `${overspentCount} categorías excedidas`,
      message:
        'Gastaste más de lo que tenían disponibles. Mueve dinero desde otra categoría para cubrir.',
      href: '/app/plan',
      ctaLabel: 'Cubrir excedidas',
      icon: 'flame',
    })
  }

  if (totalAssignedThisMonth === 0) {
    out.push({
      id: 'no-assignments',
      severity: 'info',
      title: 'Empieza tu mes',
      message:
        'Aún no has asignado dinero este mes. Dale trabajo a cada peso usando "Asignar dinero" arriba.',
      href: '/app/plan',
      ctaLabel: 'Abrir plan',
      icon: 'sparkles',
    })
  } else if (readyToAssign > 0.005) {
    out.push({
      id: 'rta-pos',
      severity: 'info',
      title: `${fmtMoneyShort(readyToAssign)} sin asignar`,
      message:
        'Cada peso con destino te acerca a tus metas. Asígnalo antes de gastarlo.',
      href: '/app/plan',
      ctaLabel: 'Asignar ahora',
      icon: 'sparkles',
    })
  }

  if (undermetGoalsCount > 0) {
    out.push({
      id: 'undermet',
      severity: 'warn',
      title:
        undermetGoalsCount === 1
          ? '1 meta sin fondear'
          : `${undermetGoalsCount} metas sin fondear`,
      message: 'Aún no llegaste al monto mensual que pediste. Asígnales dinero antes de fin de mes.',
      href: '/app/metas',
      ctaLabel: 'Ver metas',
      icon: 'target',
    })
  }

  if (closestGoal && closestGoal.progress > 0.5 && closestGoal.progress < 1) {
    out.push({
      id: 'goal-close',
      severity: 'success',
      title: `Casi llegas a ${closestGoal.name}`,
      message: `Te faltan ${fmtMoney(closestGoal.remaining)} para completar esta meta. Sigue así.`,
      href: '/app/metas',
      ctaLabel: 'Ver progreso',
      icon: 'target',
    })
  }

  if (out.length < 3 && topExpense && topExpense.amount > 0) {
    out.push({
      id: 'top-expense',
      severity: 'info',
      title: `Tu mayor gasto: ${topExpense.name}`,
      message: `Llevas ${fmtMoney(topExpense.amount)} este mes. Revisa si está alineado con tu plan.`,
      href: '/app/transacciones',
      ctaLabel: 'Ver transacciones',
      icon: 'trend-down',
    })
  }

  return out.slice(0, 3)
}
