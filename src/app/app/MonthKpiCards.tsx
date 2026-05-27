/**
 * 4 KPI cards de salud financiera del mes actual.
 *
 * Recomendado por Financial Analyst agent (auditoría 2026-05-27).
 * Reemplaza la necesidad de abrir /app/analisis para preguntas
 * frecuentes: ingresos, gastos, qué tan saludable es la tasa de
 * ahorro, y cuánto colchón tengo si paro de ganar.
 *
 * Todas las cifras vienen ya convertidas a la currency del budget
 * y excluyen transfers + saldos iniciales + ajustes de
 * reconciliación. Eso garantiza congruencia con los reportes de
 * /app/analisis (mismo método de cálculo).
 */
'use client'

import { ArrowDown, ArrowUp, type LucideIcon, PiggyBank, Wallet } from 'lucide-react'
import { useFormatMoney } from './CurrencyProvider'

interface MonthKpiCardsProps {
  totalIncome: number
  totalExpenses: number
  /** % savings rate; null cuando no hubo ingresos en el mes. */
  savingsRate: number | null
  /** Meses de runway al ritmo promedio últimos 3 meses; null si no
   *  hay gasto suficiente para promediar. */
  runwayMonths: number | null
  /** % delta vs mes pasado para ingresos. null si no hubo data
   *  previa para comparar. */
  incomeDeltaPct: number | null
  /** % delta vs mes pasado para gastos. null si no hubo data
   *  previa para comparar. */
  expenseDeltaPct: number | null
}

export function MonthKpiCards({
  totalIncome,
  totalExpenses,
  savingsRate,
  runwayMonths,
  incomeDeltaPct,
  expenseDeltaPct,
}: MonthKpiCardsProps) {
  const fmtMoney = useFormatMoney()

  // Savings rate buckets — el color refleja salud financiera.
  // <0 (gastando más que ganando) = coral, 0-10 = warn, 10-20 = neutral,
  // ≥20 = brand (estándar FIRE de "save 20%+"). Ningún valor concreto
  // es ley, pero comunicar bandas le da al usuario un marco.
  const savingsRateTone =
    savingsRate === null
      ? 'muted'
      : savingsRate < 0
        ? 'coral'
        : savingsRate < 10
          ? 'warn'
          : savingsRate < 20
            ? 'text'
            : 'brand'

  // Runway: <3 meses = coral (emergencia), 3-6 = warn, 6-12 = ok,
  // 12+ = brand (excelente). Es referencia rough; los expertos
  // recomiendan 3-6 meses de gastos en fondo de emergencia.
  const runwayTone =
    runwayMonths === null
      ? 'muted'
      : runwayMonths < 3
        ? 'coral'
        : runwayMonths < 6
          ? 'warn'
          : runwayMonths < 12
            ? 'text'
            : 'brand'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        Icon={ArrowUp}
        label="Ingresos del mes"
        value={fmtMoney(totalIncome)}
        deltaPct={incomeDeltaPct}
        deltaPositiveIsGood={true}
        tone="brand"
      />
      <KpiCard
        Icon={ArrowDown}
        label="Gastos del mes"
        value={fmtMoney(totalExpenses)}
        deltaPct={expenseDeltaPct}
        deltaPositiveIsGood={false}
        tone="coral"
      />
      <KpiCard
        Icon={PiggyBank}
        label="Tasa de ahorro"
        value={savingsRate === null ? '—' : `${savingsRate.toFixed(0)}%`}
        hint={savingsRate === null ? 'sin ingresos este mes' : undefined}
        tone={savingsRateTone}
      />
      <KpiCard
        Icon={Wallet}
        label="Colchón"
        value={
          runwayMonths === null
            ? '—'
            : runwayMonths >= 100
              ? '100+ meses'
              : `${runwayMonths.toFixed(1)} meses`
        }
        hint={
          runwayMonths === null
            ? 'sin historial de gasto'
            : 'cuánto aguantas si paras de ganar'
        }
        tone={runwayTone}
      />
    </div>
  )
}

type Tone = 'brand' | 'coral' | 'warn' | 'text' | 'muted'

const TONE_TO_CLASS: Record<Tone, string> = {
  brand: 'text-[var(--brand-text)]',
  coral: 'text-[var(--coral-text)]',
  warn: 'text-[var(--warn-text)]',
  text: 'text-[var(--text)]',
  muted: 'text-[var(--muted)]',
}

interface KpiCardProps {
  Icon: LucideIcon
  label: string
  value: string
  /** % cambio vs período anterior. null = ocultar la línea de delta. */
  deltaPct?: number | null
  /** Para deltas: ¿un valor positivo significa cosa buena? Income
   *  positivo es bueno (+12% verde). Expense positivo es malo (+12%
   *  rojo). Esto invierte el código de color sin invertir el número. */
  deltaPositiveIsGood?: boolean
  /** Hint debajo del valor cuando NO hay delta (tasa de ahorro, runway). */
  hint?: string
  tone: Tone
}

function KpiCard({
  Icon,
  label,
  value,
  deltaPct,
  deltaPositiveIsGood,
  hint,
  tone,
}: KpiCardProps) {
  const valueClass = TONE_TO_CLASS[tone]
  const deltaTone =
    deltaPct === null || deltaPct === undefined
      ? null
      : Math.abs(deltaPct) < 0.5
        ? 'muted'
        : (deltaPct > 0) === !!deltaPositiveIsGood
          ? 'brand'
          : 'coral'

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-eyebrow uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold truncate">
          {label}
        </span>
        <Icon size={14} strokeWidth={2.2} className={`shrink-0 ${valueClass}`} />
      </div>
      <div className={`text-h2 sm:text-[26px] font-bold tabular-nums num leading-none ${valueClass}`}>
        {value}
      </div>
      {deltaPct !== null && deltaPct !== undefined && deltaTone ? (
        <div className={`text-meta tabular-nums num ${TONE_TO_CLASS[deltaTone]}`}>
          {deltaPct > 0 ? '+' : ''}
          {deltaPct.toFixed(1)}% vs mes pasado
        </div>
      ) : hint ? (
        <div className="text-meta text-[var(--muted)] truncate">{hint}</div>
      ) : (
        <div className="text-meta text-[var(--muted)]">—</div>
      )}
    </section>
  )
}
