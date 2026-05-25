import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>
}) {
  const params = await searchParams
  const provider = params.provider === 'paypal' ? 'PayPal' : 'Azul'

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] flex items-center justify-center mb-6">
        <CheckCircle2 size={28} strokeWidth={2.2} />
      </div>
      <h1 className="text-[28px] font-bold tracking-tight">
        Listo, eres <span className="gradient-text">Pro</span>
      </h1>
      <p className="text-body text-[var(--text2)] leading-relaxed mt-3">
        Pago confirmado vía {provider}. Si tu plan no se actualiza en unos
        segundos, recarga la página — el cambio entra en cuanto su sistema
        nos avise.
      </p>
      <Link
        href="/app"
        className="mt-6 h-11 px-6 gradient-bg text-[#0B0B0C] font-semibold text-body rounded-xl glow-on-hover hover:brightness-105 inline-flex items-center gap-2 transition-[filter]"
      >
        Volver al resumen
        <ArrowRight size={14} strokeWidth={2.4} />
      </Link>
    </div>
  )
}
