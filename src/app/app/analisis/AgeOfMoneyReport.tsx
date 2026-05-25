'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Hourglass, Sparkles, Calendar, ArrowUp, ArrowDown } from 'lucide-react'
import { AgeOfMoneyChart } from './AgeOfMoneyChart'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Stat } from '@/components/ui/Stat'
import { Card } from '@/components/ui/Card'

export type AomRange = 'six_months' | 'twelve_months' | 'twenty_four_months'

const RANGE_LABELS: Record<AomRange, string> = {
  six_months: '6 meses',
  twelve_months: '12 meses',
  twenty_four_months: '24 meses',
}

export interface AgeOfMoneyPoint {
  month: string
  label: string
  ageDays: number | null
}

interface Props {
  range: AomRange
  rangeLabel: string
  series: AgeOfMoneyPoint[]
  hasBudget: boolean
  hasData: boolean
}

const interpretation = (days: number | null): { tag: string; copy: string } => {
  if (days === null) {
    return {
      tag: 'Sin datos',
      copy: 'Aún no hay suficientes ingresos y gastos registrados para calcular este mes.',
    }
  }
  if (days < 4) {
    return {
      tag: 'Justo justo',
      copy: 'Estás gastando lo que recién entra. Cada peso nuevo paga un compromiso viejo.',
    }
  }
  if (days < 8) {
    return {
      tag: 'Semana a semana',
      copy: 'Tienes unos días de margen. Un colchón pequeño pero real.',
    }
  }
  if (days < 15) {
    return {
      tag: 'Llegando con calma',
      copy: 'Pasas de la mitad del mes con tu dinero más reciente. Vas bien.',
    }
  }
  if (days < 31) {
    return {
      tag: 'Buen colchón',
      copy: 'El dinero que gastas hoy llegó hace varias semanas. Estás manejando con anticipación.',
    }
  }
  if (days < 61) {
    return {
      tag: 'Un mes adelante',
      copy: 'Tienes un mes completo de adelanto. Tu plan respira.',
    }
  }
  return {
    tag: 'Tu dinero trabaja con calma',
    copy: 'Estás gastando dinero de hace meses. Has construido un buffer real.',
  }
}

export function AgeOfMoneyReport({ range, rangeLabel, series, hasBudget, hasData }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setRange = (next: AomRange) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'twelve_months') sp.delete('range')
    else sp.set('range', next)
    startTransition(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/analisis?${qs}` : '/app/analisis?report=age_of_money')
    })
  }

  if (!hasBudget) {
    return (
      <PageHeader
        eyebrow="Análisis · Edad del dinero"
        description="Termina el onboarding para ver este reporte."
      >
        Sin presupuesto <span className="gradient-text">aún</span>.
      </PageHeader>
    )
  }

  // Latest non-null point
  const latest = [...series].reverse().find((p) => p.ageDays !== null)
  const latestAge = latest?.ageDays ?? null
  const latestLabel = latest?.label ?? null
  const interp = interpretation(latestAge)

  // Stats across the range
  const validPoints = series.filter((p) => p.ageDays !== null) as Array<
    AgeOfMoneyPoint & { ageDays: number }
  >
  const avgAge =
    validPoints.length > 0
      ? validPoints.reduce((s, p) => s + p.ageDays, 0) / validPoints.length
      : null
  const minPoint = validPoints.length > 0
    ? validPoints.reduce((min, p) => (p.ageDays < min.ageDays ? p : min))
    : null
  const maxPoint = validPoints.length > 0
    ? validPoints.reduce((max, p) => (p.ageDays > max.ageDays ? p : max))
    : null

  // Delta from first to last valid point
  const firstValid = validPoints[0]
  const lastValid = validPoints[validPoints.length - 1]
  const delta =
    firstValid && lastValid && firstValid !== lastValid
      ? lastValid.ageDays - firstValid.ageDays
      : null

  return (
    <div className={`space-y-7 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      <PageHeader
        eyebrow="Análisis · Edad del dinero"
        description={`Días entre que el dinero entra y sale · ${rangeLabel}`}
      >
        ¿Qué tan <span className="gradient-text">viejo</span> es tu dinero?
      </PageHeader>

      <SegmentedTabs
        value={range}
        onChange={setRange}
        ariaLabel="Rango"
        options={(Object.keys(RANGE_LABELS) as AomRange[]).map((r) => ({
          value: r,
          label: RANGE_LABELS[r],
        }))}
      />

      {/* Hero card */}
      <div className="rounded-2xl border-2 border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)] px-6 py-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-meta uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
              {latestLabel ? `Edad del dinero · ${latestLabel}` : 'Edad del dinero'}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <div className="text-[48px] sm:text-[56px] font-bold tabular-nums num leading-none gradient-text">
                {latestAge !== null ? Math.round(latestAge) : '—'}
              </div>
              <div className="text-h3 font-semibold text-[var(--text2)]">días</div>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--overlay-1)]">
              <Sparkles size={12} strokeWidth={2.4} className="text-[var(--brand-text)]" />
              <span className="text-meta font-medium text-[var(--text)]">{interp.tag}</span>
            </div>
            <p className="text-body-sm text-[var(--text2)] leading-relaxed mt-3 max-w-md">
              {interp.copy}
            </p>
          </div>
          {delta !== null && Math.abs(delta) > 0.5 && (
            <div className="text-right shrink-0">
              <div className="text-eyebrow uppercase tracking-[0.18em] text-[var(--muted)] font-semibold">
                vs hace {rangeLabel.toLowerCase()}
              </div>
              <div
                className={`text-h2 font-bold tabular-nums num mt-2 inline-flex items-center gap-1.5 ${
                  delta > 0 ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
                }`}
              >
                {delta > 0 ? (
                  <ArrowUp size={16} strokeWidth={2.4} />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.4} />
                )}
                {Math.abs(Math.round(delta))} días
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {validPoints.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            label="Promedio del rango"
            value={avgAge !== null ? `${Math.round(avgAge)} días` : '—'}
            Icon={Calendar}
          />
          <Stat
            label="Mejor mes"
            value={maxPoint ? `${Math.round(maxPoint.ageDays)} días` : '—'}
            sub={maxPoint?.label}
            Icon={ArrowUp}
            iconColor="text-[var(--brand-text)]"
          />
          <Stat
            label="Más ajustado"
            value={minPoint ? `${Math.round(minPoint.ageDays)} días` : '—'}
            sub={minPoint?.label}
            Icon={ArrowDown}
            iconColor="text-[var(--coral-text)]"
          />
        </div>
      )}

      {/* Chart */}
      {!hasData ? (
        <EmptyState
          Icon={Hourglass}
          title="Sin datos suficientes"
          description="Necesitas al menos un mes con ingresos y gastos registrados para calcular este indicador."
        />
      ) : (
        <Card padding="md" className="overflow-x-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-emph font-semibold text-[var(--text)]">Evolución mensual</h2>
            <div className="text-eyebrow text-[var(--muted)]">
              {validPoints.length} {validPoints.length === 1 ? 'mes con datos' : 'meses con datos'}
            </div>
          </div>
          <AgeOfMoneyChart data={series} />
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-eyebrow text-[var(--muted)] leading-relaxed max-w-2xl">
        Calculado con FIFO: cada peso de ingreso se &quot;sella&quot; con su fecha y se gasta de los más viejos
        primero. La edad del dinero del mes es el promedio ponderado de los días entre que cada peso
        gastado entró y se gastó.
      </p>
    </div>
  )
}

