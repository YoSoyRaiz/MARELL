'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CreditCard,
  Percent,
  Scale,
  TrendingDown,
  Wallet,
  Zap,
  Calendar,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { fetchDebtHealth, type DebtHealthResult } from './actions'
import { generateMonthlyInterest } from '../cuentas/actions'
import { useFormatMoney } from '../CurrencyProvider'

/**
 * Salud de deudas — el reporte que faltaba en MARELL para usuarios
 * con tarjetas/préstamos: cuánto debes, a qué tasa efectiva, cuánto
 * pierdes al mes en intereses, y proyección de cuándo terminas.
 *
 * Componente client-side porque tiene calculadora interactiva
 * (slider de pago mensual, comparativa avalanche vs snowball) que
 * son derivaciones puras de la data — no requieren ir al server.
 */
export function DebtHealthReport({ hasBudget }: { hasBudget: boolean }) {
  const fmtMoney = useFormatMoney()
  const [data, setData] = useState<DebtHealthResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [genStatus, setGenStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'done'; generated: number; skipped: number }
    | { kind: 'error'; msg: string }
  >({ kind: 'idle' })

  useEffect(() => {
    if (!hasBudget) {
      setLoading(false)
      return
    }
    fetchDebtHealth().then((r) => {
      setData(r)
      setLoading(false)
    })
  }, [hasBudget])

  const handleGenerate = async () => {
    setGenStatus({ kind: 'pending' })
    const r = await generateMonthlyInterest()
    if (r.error) {
      setGenStatus({ kind: 'error', msg: r.error })
      return
    }
    setGenStatus({ kind: 'done', generated: r.generated ?? 0, skipped: r.skipped ?? 0 })
    // Refresh data to reflect new txns en balance/intereses
    const fresh = await fetchDebtHealth()
    setData(fresh)
  }

  if (!hasBudget) {
    return (
      <PageHeader
        eyebrow="Análisis · Salud de deudas"
        description="Termina el onboarding para ver este reporte."
      >
        Sin presupuesto <span className="gradient-text">aún</span>.
      </PageHeader>
    )
  }

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-body-sm text-[var(--muted)] inline-flex items-center justify-center gap-2 w-full">
        <Spinner /> Cargando deudas…
      </div>
    )
  }

  if (data.error) {
    return (
      <PageHeader eyebrow="Análisis · Salud de deudas" description={data.error}>
        Sin <span className="gradient-text">data</span>.
      </PageHeader>
    )
  }

  const debts = data.debts ?? []
  if (debts.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow="Análisis · Salud de deudas"
          description="No tienes cuentas de deuda registradas. ¡Sigue así!"
        >
          Cero <span className="gradient-text">deudas</span>.
        </PageHeader>
        <EmptyState
          Icon={Wallet}
          title="Sin deudas activas"
          description="Cuando agregues una tarjeta de crédito, préstamo o hipoteca, aquí verás métricas de salud y proyecciones de pago."
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Análisis · Salud de deudas"
        description={`${debts.length} ${debts.length === 1 ? 'cuenta' : 'cuentas'} de deuda activas · análisis y proyecciones`}
      >
        Tu pulso de <span className="gradient-text">deudas</span>.
      </PageHeader>

      {/* Alertas */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <Alert key={i} severity={a.severity} message={a.message} />
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          Icon={TrendingDown}
          label="Total deudas"
          value={fmtMoney(data.totalDebtDOP ?? 0)}
          tone="coral"
        />
        <KpiCard
          Icon={Percent}
          label="APR promedio"
          value={`${(data.weightedAvgApr ?? 0).toFixed(2)}%`}
          tone={
            (data.weightedAvgApr ?? 0) >= 25
              ? 'coral'
              : (data.weightedAvgApr ?? 0) >= 15
                ? 'warn'
                : 'text'
          }
          hint="ponderado por balance"
        />
        <KpiCard
          Icon={Zap}
          label="Intereses al mes"
          value={fmtMoney(data.totalMonthlyInterest ?? 0)}
          tone="warn"
          hint="lo que pierdes si solo pagas mínimo"
        />
        <KpiCard
          Icon={Scale}
          label="Deuda / ingresos"
          value={
            data.debtToIncomeRatio == null
              ? '—'
              : `${data.debtToIncomeRatio.toFixed(2)}x`
          }
          tone={
            data.debtToIncomeRatio == null
              ? 'muted'
              : data.debtToIncomeRatio > 1
                ? 'coral'
                : data.debtToIncomeRatio > 0.5
                  ? 'warn'
                  : 'text'
          }
          hint={
            data.debtToIncomeRatio == null
              ? 'sin ingresos registrados'
              : data.debtToIncomeRatio > 0.5
                ? 'sobre 0.5x = estrés'
                : 'sano'
          }
        />
      </div>

      {/* Generador manual de intereses */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-emph font-semibold text-[var(--text)]">
              Reconocer intereses del mes pasado
            </h2>
            <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed max-w-xl">
              MARELL puede generar automáticamente una transacción
              estimada de intereses por cada cuenta de deuda con APR.
              Idempotente: si ya generaste, hace skip. El cron mensual
              también lo corre solo el día 1 de cada mes.
            </p>
            {genStatus.kind === 'done' && (
              <p className="text-meta text-[var(--brand-text)] mt-2">
                ✓ {genStatus.generated} {genStatus.generated === 1 ? 'transacción generada' : 'transacciones generadas'}
                {genStatus.skipped > 0 && ` · ${genStatus.skipped} omitidas (ya existían)`}
              </p>
            )}
            {genStatus.kind === 'error' && (
              <p className="text-meta text-[var(--coral-text)] mt-2">
                {genStatus.msg}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={genStatus.kind === 'pending'}
            className="h-10 px-4 rounded-xl text-body-sm font-semibold inline-flex items-center gap-2 bg-[var(--overlay-1)] hover:bg-[var(--overlay-2)] text-[var(--text)] border border-[var(--border)] transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
          >
            {genStatus.kind === 'pending' ? (
              <>
                <Spinner /> Generando…
              </>
            ) : (
              <>
                <Zap size={14} strokeWidth={2.2} /> Generar intereses
              </>
            )}
          </button>
        </div>
      </Card>

      {/* Trayectoria histórica de deuda */}
      {data.debtHistory && data.debtHistory.length > 0 && (
        <Card className="p-5">
          <h3 className="text-emph font-semibold text-[var(--text)] mb-4">
            Trayectoria de deuda total (12 meses)
          </h3>
          <DebtTrajectoryChart
            series={data.debtHistory}
            fmtMoney={fmtMoney}
          />
        </Card>
      )}

      {/* Detalle por deuda */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-meta font-semibold uppercase tracking-[0.18em] text-[var(--muted2)]">
            Detalle por cuenta
          </h3>
          <span className="text-eyebrow text-[var(--muted)]">
            {debts.length} {debts.length === 1 ? 'cuenta' : 'cuentas'}
          </span>
        </div>
        <div className="hidden md:grid grid-cols-[1fr_120px_80px_140px_80px] gap-4 px-5 py-2 text-tiny uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
          <div>Cuenta</div>
          <div className="text-right">Balance</div>
          <div className="text-right">APR</div>
          <div className="text-right">Intereses/mes</div>
          <div className="text-right">% total</div>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {debts.map((d) => {
            const pct =
              (data.totalDebtDOP ?? 0) > 0
                ? (d.balanceDOP / (data.totalDebtDOP ?? 1)) * 100
                : 0
            return (
              <li
                key={d.id}
                className="grid grid-cols-[1fr_120px_80px_140px_80px] gap-4 px-5 py-3 items-center text-body-sm"
              >
                <div className="min-w-0">
                  <div className="text-[var(--text)] truncate inline-flex items-center gap-2">
                    <CreditCard size={12} strokeWidth={2.2} className="text-[var(--muted)] shrink-0" />
                    {d.name}
                  </div>
                  <div className="text-tiny text-[var(--muted)] mt-0.5">
                    {d.nativeCurrency !== 'DOP'
                      ? `${d.nativeCurrency} ${d.balanceNative.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : d.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="text-right tabular-nums num text-[var(--coral-text)]">
                  −{fmtMoney(d.balanceDOP)}
                </div>
                <div className="text-right tabular-nums num text-[var(--text2)]">
                  {d.apr === null ? '—' : `${d.apr.toFixed(1)}%`}
                </div>
                <div className="text-right tabular-nums num text-[var(--warn-text)] font-semibold">
                  {d.apr === null ? '—' : fmtMoney(d.monthlyInterestDOP)}
                </div>
                <div className="text-right tabular-nums num text-[var(--muted)]">
                  {pct.toFixed(1)}%
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      {/* Calculadora de pago */}
      <PayoffCalculator debts={debts} fmtMoney={fmtMoney} />

      {/* Avalanche vs Snowball */}
      {debts.length >= 2 && (
        <StrategyCompare debts={debts} fmtMoney={fmtMoney} />
      )}
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────

function Alert({
  severity,
  message,
}: {
  severity: 'high' | 'medium' | 'low'
  message: string
}) {
  const styles = {
    high: 'border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] text-[var(--coral-text)]',
    medium: 'border-[var(--warn)]/40 bg-[rgba(245,200,66,0.06)] text-[var(--warn-text)]',
    low: 'border-[var(--info)]/40 bg-[rgba(77,168,255,0.06)] text-[var(--info-text)]',
  }[severity]
  return (
    <div className={`rounded-xl border px-4 py-3 inline-flex items-start gap-2.5 w-full ${styles}`}>
      <AlertTriangle size={14} strokeWidth={2.2} className="shrink-0 mt-0.5" />
      <span className="text-body-sm leading-relaxed">{message}</span>
    </div>
  )
}

function KpiCard({
  Icon,
  label,
  value,
  hint,
  tone,
}: {
  Icon: typeof TrendingDown
  label: string
  value: string
  hint?: string
  tone: 'brand' | 'coral' | 'warn' | 'text' | 'muted'
}) {
  const color = {
    brand: 'text-[var(--brand-text)]',
    coral: 'text-[var(--coral-text)]',
    warn: 'text-[var(--warn-text)]',
    text: 'text-[var(--text)]',
    muted: 'text-[var(--muted)]',
  }[tone]
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-eyebrow uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold truncate">
          {label}
        </span>
        <Icon size={14} strokeWidth={2.2} className={`shrink-0 ${color}`} />
      </div>
      <div className={`text-h2 sm:text-[24px] font-bold tabular-nums num leading-none ${color}`}>
        {value}
      </div>
      {hint && <div className="text-meta text-[var(--muted)] truncate">{hint}</div>}
    </section>
  )
}

function DebtTrajectoryChart({
  series,
  fmtMoney,
}: {
  series: { month: string; label: string; total: number }[]
  fmtMoney: (n: number) => string
}) {
  const max = Math.max(...series.map((p) => p.total), 1)
  return (
    <div className="relative h-48">
      <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="none">
        {/* Gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1="0"
            y1={20 + (160 - 20) * (1 - f)}
            x2="400"
            y2={20 + (160 - 20) * (1 - f)}
            stroke="var(--border)"
            strokeWidth="0.5"
          />
        ))}
        {/* Line */}
        <polyline
          fill="none"
          stroke="var(--coral)"
          strokeWidth="2"
          points={series
            .map((p, i) => {
              const x = (i / Math.max(1, series.length - 1)) * 400
              const y = 20 + (160 - 20) * (1 - p.total / max)
              return `${x},${y}`
            })
            .join(' ')}
        />
        {/* Dots */}
        {series.map((p, i) => {
          const x = (i / Math.max(1, series.length - 1)) * 400
          const y = 20 + (160 - 20) * (1 - p.total / max)
          return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--coral)" />
        })}
      </svg>
      <div className="flex justify-between text-tiny text-[var(--muted2)] mt-1 px-1">
        {series.filter((_, i) => i % 2 === 0).map((p) => (
          <span key={p.month} className="tabular-nums">
            {p.label.split(' ')[0]}
          </span>
        ))}
      </div>
      <div className="absolute top-0 right-0 text-tiny text-[var(--muted)] tabular-nums">
        Pico: {fmtMoney(max)}
      </div>
    </div>
  )
}

// ── Calculadora de payoff ──────────────────────────────────────

function PayoffCalculator({
  debts,
  fmtMoney,
}: {
  debts: NonNullable<DebtHealthResult['debts']>
  fmtMoney: (n: number) => string
}) {
  const [selectedDebtId, setSelectedDebtId] = useState(debts[0]?.id ?? '')
  const selected = debts.find((d) => d.id === selectedDebtId) ?? debts[0]
  // Default: 3% del balance (pago mínimo típico de tarjetas)
  const defaultPayment = useMemo(() => {
    if (!selected) return 0
    return Math.max(500, Math.round((selected.balanceDOP * 0.03) / 100) * 100)
  }, [selected])
  const [payment, setPayment] = useState<number>(defaultPayment)

  useEffect(() => {
    setPayment(defaultPayment)
  }, [defaultPayment])

  if (!selected) return null

  const projection = useMemo(
    () => projectPayoff(selected.balanceDOP, selected.apr ?? 0, payment),
    [selected, payment],
  )

  // Comparativa con un pago "extra" 50% mayor
  const enhancedPayment = Math.round(payment * 1.5)
  const enhancedProjection = useMemo(
    () => projectPayoff(selected!.balanceDOP, selected!.apr ?? 0, enhancedPayment),
    [selected, enhancedPayment],
  )

  return (
    <Card className="p-5">
      <h3 className="text-emph font-semibold text-[var(--text)] mb-1">
        ¿Cuándo termino de pagar?
      </h3>
      <p className="text-meta text-[var(--muted)] mb-4">
        Calculadora amortización francesa estándar (interés sobre saldo).
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
            Cuenta
          </label>
          <select
            value={selectedDebtId}
            onChange={(e) => setSelectedDebtId(e.target.value)}
            className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl"
          >
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({fmtMoney(d.balanceDOP)} · {d.apr?.toFixed(1) ?? '—'}% APR)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
            Pago mensual (DOP)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={payment}
            onChange={(e) => setPayment(Math.max(0, Number(e.target.value) || 0))}
            className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl tabular-nums num"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ProjStat
          label="Tiempo de pago"
          value={
            projection.feasible
              ? formatMonths(projection.months)
              : 'Insuficiente'
          }
          hint={
            !projection.feasible
              ? 'El pago no cubre el interés mensual'
              : undefined
          }
          tone={projection.feasible ? 'text' : 'coral'}
        />
        <ProjStat
          label="Intereses totales"
          value={projection.feasible ? fmtMoney(projection.totalInterest) : '—'}
          tone="warn"
        />
        <ProjStat
          label="Total a pagar"
          value={projection.feasible ? fmtMoney(projection.totalPaid) : '—'}
          tone="text"
        />
      </div>

      {projection.feasible && enhancedProjection.feasible && payment > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)] px-4 py-3">
          <p className="text-meta text-[var(--text2)] leading-relaxed">
            <span className="font-semibold text-[var(--brand-text)]">
              💡 Si pagaras {fmtMoney(enhancedPayment)}/mes
            </span>{' '}
            (50% más):{' '}
            <span className="font-semibold">{formatMonths(enhancedProjection.months)}</span>{' '}
            de pago,{' '}
            <span className="font-semibold">
              ahorrarías {fmtMoney(projection.totalInterest - enhancedProjection.totalInterest)}
            </span>{' '}
            en intereses.
          </p>
        </div>
      )}
    </Card>
  )
}

function ProjStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone: 'brand' | 'coral' | 'warn' | 'text'
}) {
  const color = {
    brand: 'text-[var(--brand-text)]',
    coral: 'text-[var(--coral-text)]',
    warn: 'text-[var(--warn-text)]',
    text: 'text-[var(--text)]',
  }[tone]
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
      <div className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
        {label}
      </div>
      <div className={`text-h3 font-bold tabular-nums num mt-1 ${color}`}>{value}</div>
      {hint && (
        <div className="text-tiny text-[var(--muted)] mt-1 leading-snug">{hint}</div>
      )}
    </div>
  )
}

// ── Avalanche vs Snowball ───────────────────────────────────────

function StrategyCompare({
  debts,
  fmtMoney,
}: {
  debts: NonNullable<DebtHealthResult['debts']>
  fmtMoney: (n: number) => string
}) {
  const totalDebt = debts.reduce((s, d) => s + d.balanceDOP, 0)
  // Pago mensual base: 3% del total, mín RD$5000
  const defaultMonthly = Math.max(5000, Math.round((totalDebt * 0.03) / 100) * 100)
  const [monthly, setMonthly] = useState<number>(defaultMonthly)

  useEffect(() => {
    setMonthly(defaultMonthly)
  }, [defaultMonthly])

  const avalanche = useMemo(() => simulateStrategy(debts, monthly, 'avalanche'), [debts, monthly])
  const snowball = useMemo(() => simulateStrategy(debts, monthly, 'snowball'), [debts, monthly])

  return (
    <Card className="p-5">
      <h3 className="text-emph font-semibold text-[var(--text)] mb-1">
        Estrategia: Avalanche vs Snowball
      </h3>
      <p className="text-meta text-[var(--muted)] mb-4 leading-relaxed">
        Asumiendo que pagas{' '}
        <span className="font-semibold text-[var(--text2)]">{fmtMoney(monthly)}/mes</span>{' '}
        en total entre todas tus deudas.
      </p>

      <div className="mb-4">
        <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
          Pago mensual total (DOP)
        </label>
        <input
          type="number"
          min={0}
          step={500}
          value={monthly}
          onChange={(e) => setMonthly(Math.max(0, Number(e.target.value) || 0))}
          className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl tabular-nums num"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <StrategyCard
          name="Avalanche"
          subtitle="Mayor APR primero — óptimo matemáticamente"
          months={avalanche.months}
          totalInterest={avalanche.totalInterest}
          fmtMoney={fmtMoney}
          highlight={
            avalanche.totalInterest != null &&
            snowball.totalInterest != null &&
            avalanche.totalInterest <= snowball.totalInterest
          }
        />
        <StrategyCard
          name="Snowball"
          subtitle="Menor balance primero — momentum psicológico"
          months={snowball.months}
          totalInterest={snowball.totalInterest}
          fmtMoney={fmtMoney}
          highlight={
            avalanche.totalInterest != null &&
            snowball.totalInterest != null &&
            snowball.totalInterest < avalanche.totalInterest
          }
        />
      </div>

      {avalanche.feasible &&
        snowball.feasible &&
        avalanche.totalInterest != null &&
        snowball.totalInterest != null && (
          <p className="text-meta text-[var(--muted)] mt-4 leading-relaxed">
            {avalanche.totalInterest < snowball.totalInterest
              ? `📊 Avalanche te ahorra ${fmtMoney(snowball.totalInterest - avalanche.totalInterest)} en intereses, pero tomas más tiempo en "ver progreso" porque empiezas con tu deuda mayor.`
              : `📊 Snowball y avalanche tienen costo similar aquí. Snowball es más fácil de mantener emocionalmente.`}
          </p>
        )}
      {(!avalanche.feasible || !snowball.feasible) && (
        <p className="text-meta text-[var(--coral-text)] mt-4">
          El pago mensual no cubre los intereses combinados — sube el pago para ver proyecciones.
        </p>
      )}
    </Card>
  )
}

function StrategyCard({
  name,
  subtitle,
  months,
  totalInterest,
  fmtMoney,
  highlight,
}: {
  name: string
  subtitle: string
  months: number | null
  totalInterest: number | null
  fmtMoney: (n: number) => string
  highlight: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        highlight
          ? 'border-[var(--brand-2)]/40 bg-[rgba(61,220,151,0.04)]'
          : 'border-[var(--border)] bg-[var(--bg)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-emph font-bold text-[var(--text)] inline-flex items-center gap-2">
          {name}
          {highlight && (
            <span className="text-tiny uppercase tracking-[0.15em] text-[var(--brand-text)] bg-[rgba(61,220,151,0.10)] px-1.5 py-0.5 rounded">
              Mejor
            </span>
          )}
        </div>
      </div>
      <p className="text-meta text-[var(--muted)] mt-1">{subtitle}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
            Tiempo
          </div>
          <div className="text-body-sm font-bold tabular-nums num text-[var(--text)] mt-0.5">
            {months === null ? '—' : formatMonths(months)}
          </div>
        </div>
        <div>
          <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
            Intereses
          </div>
          <div className="text-body-sm font-bold tabular-nums num text-[var(--warn-text)] mt-0.5">
            {totalInterest === null ? '—' : fmtMoney(totalInterest)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Math helpers ────────────────────────────────────────────────

/**
 * Amortización francesa: dado balance B, APR anual r%, y pago P
 * mensual, simula mes a mes hasta que el balance se agota o
 * determina que es infeasible.
 *
 * El cap de 600 meses (50 años) evita loops eternos si el pago
 * es exactamente igual al interés mensual.
 */
function projectPayoff(
  balance: number,
  aprPercent: number,
  payment: number,
): { feasible: boolean; months: number; totalInterest: number; totalPaid: number } {
  if (balance <= 0.005) return { feasible: true, months: 0, totalInterest: 0, totalPaid: 0 }
  if (payment <= 0) return { feasible: false, months: 0, totalInterest: 0, totalPaid: 0 }
  const i = aprPercent / 100 / 12
  // Si interés mensual >= payment, no se reduce nunca
  const monthlyInterest = balance * i
  if (i > 0 && payment <= monthlyInterest + 0.005) {
    return { feasible: false, months: 0, totalInterest: 0, totalPaid: 0 }
  }
  let remaining = balance
  let totalInterest = 0
  let totalPaid = 0
  let months = 0
  while (remaining > 0.005 && months < 600) {
    const interest = remaining * i
    const principal = Math.min(payment - interest, remaining)
    const thisPay = interest + principal
    remaining -= principal
    totalInterest += interest
    totalPaid += thisPay
    months++
  }
  return {
    feasible: months < 600,
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
  }
}

/**
 * Simula avalanche o snowball: paga el mínimo en todas + extra
 * en la "objetivo". Cuando una se paga, libera su pago al
 * siguiente objetivo. Termina cuando todas están en cero.
 *
 * Mínimo asumido: 3% del balance por deuda (estándar tarjetas DR).
 */
function simulateStrategy(
  debts: NonNullable<DebtHealthResult['debts']>,
  monthlyTotal: number,
  strategy: 'avalanche' | 'snowball',
): { feasible: boolean; months: number | null; totalInterest: number | null } {
  // Snapshot mutable
  const work = debts.map((d) => ({
    id: d.id,
    balance: d.balanceDOP,
    apr: d.apr ?? 0,
    minPayment: Math.max(500, d.balanceDOP * 0.03),
  }))
  const totalMin = work.reduce((s, d) => s + d.minPayment, 0)
  if (monthlyTotal < totalMin) {
    return { feasible: false, months: null, totalInterest: null }
  }
  let months = 0
  let totalInterest = 0
  while (work.some((d) => d.balance > 0.005) && months < 600) {
    // 1. Calcula interés del mes para cada uno
    const active = work.filter((d) => d.balance > 0.005)
    if (active.length === 0) break
    let availableExtra = monthlyTotal
    for (const d of active) {
      const interest = d.balance * (d.apr / 100 / 12)
      totalInterest += interest
      d.balance += interest
      availableExtra -= d.minPayment
      d.balance -= d.minPayment
      if (d.balance < 0) d.balance = 0
    }
    // 2. Aplica el extra al objetivo según estrategia
    if (availableExtra > 0) {
      const ordered = [...active.filter((d) => d.balance > 0.005)]
      if (strategy === 'avalanche') ordered.sort((a, b) => b.apr - a.apr)
      else ordered.sort((a, b) => a.balance - b.balance)
      const target = ordered[0]
      if (target) {
        const apply = Math.min(availableExtra, target.balance)
        target.balance -= apply
      }
    }
    months++
  }
  return {
    feasible: months < 600,
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
  }
}

function formatMonths(months: number): string {
  if (months >= 600) return '50+ años'
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  const yearsLabel = `${years} ${years === 1 ? 'año' : 'años'}`
  if (rem === 0) return yearsLabel
  return `${yearsLabel} ${rem} ${rem === 1 ? 'mes' : 'meses'}`
}
