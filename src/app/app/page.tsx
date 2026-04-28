import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { ResetOnboardingButton } from './ResetOnboardingButton'

export default function ResumenPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Resumen
        </div>
        <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
          Tu mes en una <span className="gradient-text">mirada</span>.
        </h1>
        <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
          Pronto vas a ver aquí ingresos, gastos, categorías y transacciones recientes.
          Por ahora, asigna dinero a tu plan o explora tus cuentas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <Link
          href="/app/plan"
          className="rounded-2xl border-2 border-[var(--border)] bg-[var(--s1)] hover:border-[var(--brand-2)] hover:bg-white/[0.02] p-6 group transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-[#0B0B0C] mb-4">
            <Sparkles size={20} strokeWidth={2.2} />
          </div>
          <div className="font-semibold text-[16px] text-[var(--text)] mb-1">Asignar dinero</div>
          <div className="text-[13px] text-[var(--text2)] mb-4 leading-relaxed">
            Dale un trabajo a cada peso en tu Plan.
          </div>
          <div className="text-[13px] text-[var(--brand-2)] font-medium inline-flex items-center gap-1.5 group-hover:gap-2 transition-all">
            Ir al Plan <ArrowRight size={14} strokeWidth={2.4} />
          </div>
        </Link>

        <Link
          href="/app/cuentas"
          className="rounded-2xl border-2 border-[var(--border)] bg-[var(--s1)] hover:border-[var(--border3)] p-6 group transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] text-[var(--text2)] flex items-center justify-center mb-4">
            <ArrowRight size={20} strokeWidth={2} />
          </div>
          <div className="font-semibold text-[16px] text-[var(--text)] mb-1">Ver cuentas</div>
          <div className="text-[13px] text-[var(--text2)] mb-4 leading-relaxed">
            Balances, deudas y tracking de inversiones.
          </div>
          <div className="text-[13px] text-[var(--text2)] font-medium inline-flex items-center gap-1.5 group-hover:text-[var(--text)] transition-colors">
            Explorar <ArrowRight size={14} strokeWidth={2} />
          </div>
        </Link>
      </div>

      <div className="pt-8 border-t border-[var(--border)] flex items-center justify-between">
        <div className="text-[12px] text-[var(--muted)]">
          ¿Quieres rehacer el onboarding desde cero?
        </div>
        <ResetOnboardingButton />
      </div>
    </div>
  )
}
