import Link from 'next/link'
import { ArrowRight, Briefcase, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  PRO_PRICE_MONTH_DOP,
  PRO_PRICE_YEAR_DOP,
  PRO_PRICE_YEAR_SAVINGS_PCT,
} from '@/lib/payment'

const fmt = (n: number) =>
  `RD$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

const FREE_FEATURES = [
  '1 presupuesto',
  'Hasta 3 cuentas',
  'Transacciones manuales',
  'Reportes básicos',
] as const

const PRO_FEATURES = [
  'Cuentas ilimitadas',
  'Transacciones programadas',
  'Metas con seguimiento',
  'Los 5 reportes de Análisis',
  'Soporte prioritario',
] as const

const AUDITOR_FEATURES = [
  'Múltiples clientes en una cuenta',
  'Switch entre clientes en 1 click',
  'Dashboard unificado con KPIs',
  'Audit log de accesos',
  'Soporte prioritario',
] as const

const AUDITOR_TIERS = [
  { clients: 5, priceMonth: 2990 },
  { clients: 15, priceMonth: 6990 },
  { clients: 40, priceMonth: 14990 },
] as const

/**
 * Sección de Precios del landing — resumen de los 3 planes con CTA
 * a /pricing para ver detalle completo. No reemplaza la página de
 * pricing, solo da visibilidad temprana en el funnel.
 */
export function LandingPricing() {
  return (
    <section id="precios" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-text)]">
            Precios simples
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-[1.14] tracking-tight sm:text-[44px]">
            Un plan para{' '}
            <span className="gradient-text">cada momento</span>.
          </h2>
          <p className="mt-5 leading-relaxed text-[var(--text2)]">
            Empieza gratis. Cuando estés listo, sube a Pro o gestiona los
            presupuestos de tus clientes desde una sola cuenta.
          </p>
        </div>

        {/* 3 plans grid */}
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {/* Free */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-7 flex flex-col">
            <div className="text-eyebrow font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Free
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="text-[36px] font-extrabold leading-none tracking-tight">
                RD$0
              </div>
              <div className="text-body text-[var(--muted)]">/ siempre</div>
            </div>
            <p className="mt-3 text-body-sm text-[var(--text2)] leading-relaxed">
              Lo esencial para empezar a tomar el control.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 text-body-sm text-[var(--text)]"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--overlay-2)] text-[var(--text2)] shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-7 h-11 inline-flex items-center justify-center rounded-xl bg-[var(--overlay-2)] hover:bg-[var(--overlay-3)] text-[var(--text)] text-body font-semibold transition-colors"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl gradient-border bg-[var(--s1)] p-7 flex flex-col">
            <div className="absolute top-0 right-7 -translate-y-1/2 px-3 py-1 rounded-full text-tiny font-bold uppercase tracking-[0.18em] gradient-bg text-[#0B0B0C]">
              Recomendado
            </div>
            <div className="text-eyebrow font-bold uppercase tracking-[0.2em] text-[var(--brand-2)] inline-flex items-center gap-1.5">
              <Sparkles size={11} strokeWidth={2.4} />
              Pro
            </div>
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <div className="text-[36px] font-extrabold leading-none tracking-tight num">
                {fmt(PRO_PRICE_MONTH_DOP)}
              </div>
              <div className="text-body text-[var(--muted)]">/ mes</div>
            </div>
            <p className="mt-2 text-body-sm text-[var(--text2)]">
              <span className="text-[var(--brand-2)] font-semibold">
                {fmt(PRO_PRICE_YEAR_DOP)}/año
              </span>{' '}
              — ahorras {PRO_PRICE_YEAR_SAVINGS_PCT}%.
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {PRO_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 text-body-sm text-[var(--text)]"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--success)]/[0.15] text-[var(--success)] shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="mt-7 h-11 inline-flex items-center justify-center gap-2 rounded-xl gradient-bg text-[#0B0B0C] text-body font-semibold hover:brightness-105 transition-[filter]"
            >
              Ver detalles
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </div>

          {/* Auditor Financiero */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-7 flex flex-col">
            <div className="text-eyebrow font-bold uppercase tracking-[0.2em] text-[var(--muted)] inline-flex items-center gap-1.5">
              <Briefcase size={11} strokeWidth={2.4} />
              Auditor Financiero
            </div>
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <div className="text-[32px] font-extrabold leading-none tracking-tight num">
                Desde {fmt(AUDITOR_TIERS[0].priceMonth)}
              </div>
              <div className="text-body text-[var(--muted)]">/ mes</div>
            </div>
            <p className="mt-3 text-body-sm text-[var(--text2)] leading-relaxed">
              Para auditores y asesores que gestionan múltiples clientes.
            </p>

            {/* Mini tier strip */}
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
              {AUDITOR_TIERS.map((tier) => (
                <div
                  key={tier.clients}
                  className="flex items-center justify-between gap-3 px-3.5 py-2"
                >
                  <span className="text-body-sm text-[var(--text2)]">
                    Hasta{' '}
                    <span className="font-semibold text-[var(--text)]">
                      {tier.clients}
                    </span>{' '}
                    clientes
                  </span>
                  <span className="text-body-sm font-bold tabular-nums num text-[var(--text)]">
                    {fmt(tier.priceMonth)}
                  </span>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-2.5 flex-1">
              {AUDITOR_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 text-body-sm text-[var(--text)]"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--success)]/[0.15] text-[var(--success)] shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="mt-7 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--overlay-2)] hover:bg-[var(--overlay-3)] text-[var(--text)] text-body font-semibold transition-colors"
            >
              Ver detalles
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </div>
        </div>

        {/* Bottom link */}
        <div className="mt-10 text-center">
          <Button
            href="/pricing"
            variant="outline"
            size="md"
            iconRight={<ArrowRight size={16} strokeWidth={2.4} />}
          >
            Ver comparación completa
          </Button>
        </div>
      </div>
    </section>
  )
}
