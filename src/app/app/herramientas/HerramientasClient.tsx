'use client'

import { useMemo, useState } from 'react'
import { Calculator, Briefcase, CreditCard, Info } from 'lucide-react'
import { useFormatMoney } from '../CurrencyProvider'

/**
 * 2026 Dominican Republic payroll constants. The exact thresholds and
 * rates change every couple of years (DGII publishes the ISR table
 * annually); update these constants when DGII publishes a new escala.
 *
 * Sources:
 *   - TSS rates: AFP 2.87% (employee), SFS 3.04% (employee)
 *   - ISR escala vigente para 2026 — values in DOP/year
 */
const TSS_AFP_RATE = 0.0287
const TSS_SFS_RATE = 0.0304

const ISR_BRACKETS_ANNUAL: Array<{ from: number; to: number; rate: number; base: number }> = [
  { from: 0, to: 416_220, rate: 0, base: 0 },
  { from: 416_220.01, to: 624_329, rate: 0.15, base: 0 },
  { from: 624_329.01, to: 867_123, rate: 0.2, base: 31_216 },
  { from: 867_123.01, to: Infinity, rate: 0.25, base: 79_776 },
]

interface SalaryBreakdown {
  gross: number
  afp: number
  sfs: number
  tssTotal: number
  taxableAnnual: number
  isrAnnual: number
  isrMonthly: number
  net: number
}

function computeSalaryDR(monthlyGross: number): SalaryBreakdown {
  if (!Number.isFinite(monthlyGross) || monthlyGross <= 0) {
    return {
      gross: 0,
      afp: 0,
      sfs: 0,
      tssTotal: 0,
      taxableAnnual: 0,
      isrAnnual: 0,
      isrMonthly: 0,
      net: 0,
    }
  }
  const afp = monthlyGross * TSS_AFP_RATE
  const sfs = monthlyGross * TSS_SFS_RATE
  const tssTotal = afp + sfs
  // ISR is computed on annualized salary AFTER subtracting TSS, then we
  // bring it back to monthly.
  const taxableMonthly = monthlyGross - tssTotal
  const taxableAnnual = taxableMonthly * 12

  let isrAnnual = 0
  for (const b of ISR_BRACKETS_ANNUAL) {
    if (taxableAnnual > b.from - 0.01) {
      const top = Math.min(taxableAnnual, b.to)
      const slice = top - (b.from - 0.01)
      if (slice > 0) {
        isrAnnual += slice * b.rate
      }
    }
  }
  // The published table includes a fixed "base" amount per bracket that
  // simplifies the math when only the top bracket applies. Our slice
  // approach above already integrates correctly without using `base`,
  // so we keep `base` in the constants only as documentation.

  const isrMonthly = isrAnnual / 12
  const net = monthlyGross - tssTotal - isrMonthly

  return {
    gross: monthlyGross,
    afp,
    sfs,
    tssTotal,
    taxableAnnual,
    isrAnnual,
    isrMonthly,
    net,
  }
}

/**
 * Formats a money-input string with comma thousands separators while
 * the user types: "302000" → "302,000", "1200500.50" → "1,200,500.50".
 * Strips invalid characters and clamps decimals to 2 places.
 *
 * Pure presentation — callers still parse the raw number with
 * parseMoneyInput() before any math.
 */
function formatMoneyInput(raw: string): string {
  // Keep only digits and a single decimal point. Reject everything else
  // so paste from random sources can't poison the value.
  const cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  const intPart =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot)
  const decPart =
    firstDot === -1
      ? ''
      : '.' + cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
  // Strip leading zeros except for a lone "0" or "0.xxx".
  const intClean =
    intPart.replace(/^0+(?=\d)/, '') || (firstDot === -1 ? intPart : '0')
  const withCommas = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return withCommas + decPart
}

function parseMoneyInput(formatted: string): number {
  const cleaned = formatted.replace(/,/g, '')
  return parseFloat(cleaned) || 0
}

export function HerramientasClient() {
  const fmtMoney = useFormatMoney()
  const [salaryInput, setSalaryInput] = useState('')

  const salaryNum = parseMoneyInput(salaryInput)
  const breakdown = useMemo(() => computeSalaryDR(salaryNum), [salaryNum])

  // Cuotas calculator state (mirrors the inline one in ScheduledFormModal
  // but with a couple more fields exposed: total interest paid, total of
  // all cuotas).
  const [cuotaTotal, setCuotaTotal] = useState('')
  const [cuotaCount, setCuotaCount] = useState('')
  const [cuotaRate, setCuotaRate] = useState('')

  const cuotaTotalNum = parseMoneyInput(cuotaTotal)
  const cuotaCountNum = parseInt(cuotaCount, 10) || 0
  const cuotaRateNum = parseFloat(cuotaRate.replace(/,/g, '.')) || 0

  // Inline validation: once the user has touched ANY de los 3 campos,
  // marca como "Requerido" cualquier requerido vacío. Los tres son
  // requeridos — la tasa puede ser 0 (préstamo sin interés), pero el
  // usuario tiene que escribirla a propósito en vez de que la app la
  // asuma por él. No grita en first paint.
  const cuotaTouched =
    cuotaTotal.trim() !== '' ||
    cuotaCount.trim() !== '' ||
    cuotaRate.trim() !== ''
  const missingTotal = cuotaTouched && cuotaTotalNum <= 0
  const missingCount = cuotaTouched && cuotaCountNum <= 0
  const missingRate = cuotaTouched && cuotaRate.trim() === ''
  const cuotaIncomplete = missingTotal || missingCount || missingRate

  const cuotaResult = useMemo(() => {
    if (cuotaTotalNum <= 0 || cuotaCountNum <= 0)
      return { monthly: 0, totalPaid: 0, interest: 0 }
    let monthly = 0
    if (cuotaRateNum <= 0) {
      monthly = cuotaTotalNum / cuotaCountNum
    } else {
      const i = cuotaRateNum / 100 / 12
      monthly = (i * cuotaTotalNum) / (1 - Math.pow(1 + i, -cuotaCountNum))
    }
    const totalPaid = monthly * cuotaCountNum
    const interest = totalPaid - cuotaTotalNum
    return { monthly, totalPaid, interest }
  }, [cuotaTotalNum, cuotaCountNum, cuotaRateNum])

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Cálculos
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Cálculos hechos para <span className="gradient-text">RD</span>.
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-2xl">
          Calculadoras prácticas con las tasas y escalas vigentes en República Dominicana.
          Ideal antes de aceptar un trabajo, planificar una compra a crédito o presupuestar tu mes.
        </p>
      </div>

      {/* Salary calculator */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
              <Briefcase size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                Sueldo bruto → neto
              </h2>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">
                AFP, SFS e ISR según escala 2026.
              </p>
            </div>
          </div>
        </header>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                Sueldo bruto mensual (DOP)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={salaryInput}
                onChange={(e) => setSalaryInput(formatMoneyInput(e.target.value))}
                placeholder="50,000"
                className="w-full mt-1 !text-[18px] !font-bold !py-3 !px-4 !rounded-xl tabular-nums num"
              />
            </label>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 inline-flex items-start gap-2">
              <Info
                size={13}
                strokeWidth={2.2}
                className="text-[var(--muted2)] shrink-0 mt-0.5"
              />
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                Asumimos que tu empleador retiene TSS (AFP 2.87% + SFS 3.04%) e ISR mensual prorrateado. No incluye seguros adicionales ni aportes voluntarios.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
            <Row label="Bruto" value={fmtMoney(breakdown.gross)} />
            <Row
              label="AFP (2.87%)"
              value={`−${fmtMoney(breakdown.afp)}`}
              tone="muted"
            />
            <Row
              label="SFS (3.04%)"
              value={`−${fmtMoney(breakdown.sfs)}`}
              tone="muted"
            />
            <Row
              label="ISR"
              value={`−${fmtMoney(breakdown.isrMonthly)}`}
              tone="muted"
              hint={
                breakdown.taxableAnnual > 0
                  ? `${fmtMoney(breakdown.isrAnnual)}/año en escala ISR`
                  : undefined
              }
            />
            <Row
              label="Neto en mano"
              value={fmtMoney(breakdown.net)}
              tone="hero"
            />
          </div>
        </div>
      </section>

      {/* Cuotas calculator (standalone, deeper than the inline one in
          scheduled). */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)] flex items-center justify-center shrink-0">
              <CreditCard size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                Cuotas de financiamiento
              </h2>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">
                Cuánto pagarás por mes y cuánto realmente te cuesta el crédito.
              </p>
            </div>
          </div>
        </header>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                Total a financiar
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={cuotaTotal}
                onChange={(e) => setCuotaTotal(formatMoneyInput(e.target.value))}
                placeholder="60,000"
                aria-invalid={missingTotal || undefined}
                className={`w-full mt-1 !text-[16px] !font-semibold !py-2.5 !px-4 !rounded-xl tabular-nums num ${
                  missingTotal ? '!border-[var(--coral)]/50' : ''
                }`}
              />
              {missingTotal && (
                <span className="block mt-1 text-[11px] text-[var(--coral-text)] font-medium">
                  Requerido — escribe cuánto vas a financiar
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                  Cuotas
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cuotaCount}
                  onChange={(e) =>
                    setCuotaCount(e.target.value.replace(/[^\d]/g, ''))
                  }
                  placeholder="12"
                  aria-invalid={missingCount || undefined}
                  className={`w-full mt-1 !text-[15px] !py-2.5 !px-3 !rounded-xl tabular-nums num ${
                    missingCount ? '!border-[var(--coral)]/50' : ''
                  }`}
                />
                {missingCount && (
                  <span className="block mt-1 text-[11px] text-[var(--coral-text)] font-medium">
                    Requerido
                  </span>
                )}
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                  Tasa anual %
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cuotaRate}
                  onChange={(e) => setCuotaRate(e.target.value)}
                  placeholder="0"
                  aria-invalid={missingRate || undefined}
                  className={`w-full mt-1 !text-[15px] !py-2.5 !px-3 !rounded-xl tabular-nums num ${
                    missingRate ? '!border-[var(--coral)]/50' : ''
                  }`}
                />
                {missingRate ? (
                  <span className="block mt-1 text-[11px] text-[var(--coral-text)] font-medium">
                    Requerido · escribe 0 si es sin interés
                  </span>
                ) : (
                  <span className="block mt-1 text-[11px] text-[var(--muted)]">
                    Escribe 0 si el préstamo es sin interés
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
            {cuotaIncomplete ? (
              <div className="px-4 py-6 text-center space-y-1">
                <div className="text-[13px] font-semibold text-[var(--coral-text)]">
                  Completa los campos requeridos
                </div>
                <div className="text-[12px] text-[var(--muted)] leading-relaxed">
                  {(() => {
                    const missing: string[] = []
                    if (missingTotal) missing.push('Total a financiar')
                    if (missingCount) missing.push('Cuotas')
                    if (missingRate) missing.push('Tasa anual')
                    if (missing.length === 1)
                      return `Falta ${missing[0]}.`
                    if (missing.length === 2)
                      return `Falta ${missing[0]} y ${missing[1]}.`
                    return `Falta ${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}.`
                  })()}
                </div>
              </div>
            ) : (
              <>
                <Row label="Cuota mensual" value={fmtMoney(cuotaResult.monthly)} tone="hero" />
                <Row
                  label="Total a pagar"
                  value={fmtMoney(cuotaResult.totalPaid)}
                />
                <Row
                  label="Intereses"
                  value={fmtMoney(cuotaResult.interest)}
                  tone={cuotaResult.interest > 0 ? 'warn' : 'default'}
                  hint={
                    cuotaResult.interest > 0 && cuotaTotalNum > 0
                      ? `${((cuotaResult.interest / cuotaTotalNum) * 100).toFixed(1)}% sobre el principal`
                      : undefined
                  }
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Tip strip */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-[#0B0B0C] shrink-0">
          <Calculator size={14} strokeWidth={2.4} />
        </div>
        <div className="text-[12px] text-[var(--text2)] leading-relaxed">
          Las escalas ISR se actualizan al inicio de cada año fiscal. Cuando DGII
          publique nuevos rangos, los actualizamos en MARELL automáticamente.
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'muted' | 'hero' | 'warn'
}

function Row({ label, value, hint, tone = 'default' }: RowProps) {
  const valueClass =
    tone === 'hero'
      ? 'gradient-text text-[18px]'
      : tone === 'warn'
        ? 'text-[var(--warn-text)] text-[14px]'
        : tone === 'muted'
          ? 'text-[var(--text2)] text-[14px]'
          : 'text-[var(--text)] text-[14px]'
  return (
    <div className="px-4 py-3 flex items-baseline justify-between gap-3">
      <div className="text-[12px] text-[var(--text2)]">{label}</div>
      <div className="text-right">
        <div className={`font-semibold tabular-nums num ${valueClass}`}>{value}</div>
        {hint && <div className="text-[10px] text-[var(--muted2)] mt-0.5">{hint}</div>}
      </div>
    </div>
  )
}
