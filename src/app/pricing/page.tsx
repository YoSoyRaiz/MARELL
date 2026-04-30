import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Sparkles,
  Wallet,
  BarChart3,
  Bell,
  Repeat,
  Split,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/ui/Logo'
import { PRO_PRICE_MONTH_DOP, PRO_PRICE_YEAR_DOP, PRO_PRICE_YEAR_SAVINGS_PCT } from '@/lib/payment'
import { PricingClient } from './PricingClient'

export const metadata = {
  title: 'MARELL · Precios',
}

const FREE_FEATURES = [
  '1 presupuesto',
  'Hasta 3 cuentas',
  'Transacciones manuales',
  'Reportes básicos',
  'Categorías ilimitadas',
] as const

const PRO_FEATURES = [
  { Icon: Wallet, text: 'Cuentas ilimitadas' },
  { Icon: Split, text: 'Splits en transacciones' },
  { Icon: Repeat, text: 'Transacciones programadas' },
  { Icon: Target, text: 'Metas con seguimiento mensual y acumulado' },
  { Icon: BarChart3, text: 'Los 5 reportes de Análisis' },
  { Icon: Bell, text: 'Notificaciones por correo' },
  { Icon: Sparkles, text: 'Soporte prioritario' },
] as const

const fmt = (n: number) =>
  `RD$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--s1)]/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo height={32} priority />
          </Link>
          <Link
            href={user ? '/app' : '/login'}
            className="text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            {user ? 'Volver a la app' : 'Iniciar sesión'}
          </Link>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-16 sm:py-20">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--success)]">
            Precios simples
          </div>
          <h1 className="text-[32px] sm:text-[44px] lg:text-[52px] leading-[1.05] font-bold tracking-tight">
            Elige el plan que <span className="gradient-text">funciona para ti</span>.
          </h1>
          <p className="text-[var(--text2)] text-[15px] sm:text-[16px] leading-relaxed">
            Empieza gratis. Cuando quieras desbloquear todo, pasa a Pro por
            menos de un café al mes.
          </p>
        </div>

        {/* Pricing grid */}
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-7 sm:p-8 flex flex-col">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Free
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-[44px] font-extrabold leading-none tracking-tight">
                  RD$0
                </div>
                <div className="text-[14px] text-[var(--muted)]">/ siempre</div>
              </div>
              <p className="mt-3 text-[14px] text-[var(--text2)] leading-relaxed">
                Lo esencial para llevar el control básico de tu dinero. Sin
                tarjeta de crédito.
              </p>
            </div>

            <ul className="mt-7 space-y-3 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[14px]">
                  <span className="grid size-5 place-items-center rounded-full bg-white/[0.05] text-[var(--text2)] shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={user ? '/app' : '/signup'}
              className="mt-8 h-11 inline-flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] text-[14px] font-semibold transition-colors"
            >
              {user ? 'Ya estás en Free' : 'Empezar gratis'}
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl gradient-border p-7 sm:p-8 flex flex-col bg-[var(--s1)]">
            <div className="absolute top-0 right-7 -translate-y-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] gradient-bg text-[#0B0B0C]">
              Recomendado
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-2)]">
                Pro
              </div>
              <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                <div className="text-[44px] font-extrabold leading-none tracking-tight num">
                  {fmt(PRO_PRICE_MONTH_DOP)}
                </div>
                <div className="text-[14px] text-[var(--muted)]">/ mes</div>
              </div>
              <p className="mt-2 text-[13px] text-[var(--text2)]">
                <span className="text-[var(--brand-2)] font-semibold">
                  {fmt(PRO_PRICE_YEAR_DOP)}/año
                </span>{' '}
                — ahorras {PRO_PRICE_YEAR_SAVINGS_PCT}%.
              </p>
              <p className="mt-3 text-[14px] text-[var(--text2)] leading-relaxed">
                Todas las features pensadas para que cada peso tenga su trabajo.
              </p>
            </div>

            <ul className="mt-7 space-y-3 flex-1">
              {PRO_FEATURES.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-[14px]">
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--success)]/[0.15] text-[var(--success)] shrink-0">
                    <Icon size={11} strokeWidth={2.4} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <PricingClient userId={user?.id ?? null} userEmail={user?.email ?? null} />
          </div>
        </div>

        {/* FAQ-ish payment notes */}
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          <Note
            title="Pago manual por transferencia"
            body="Por ahora aceptamos pagos solo por transferencia bancaria. Pronto vamos a sumar tarjetas."
          />
          <Note
            title="Activación dentro de 24 horas"
            body="Al transferir, te activamos manualmente. Vas a recibir confirmación por correo."
          />
          <Note
            title="Cancela cuando quieras"
            body="No hay contratos. Si decides no renovar, simplemente no pagas el siguiente mes."
          />
        </div>
      </main>
    </div>
  )
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[13px] text-[var(--text2)] leading-relaxed">
        {body}
      </p>
    </div>
  )
}
