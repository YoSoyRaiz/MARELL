import { X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { InteractiveCard } from './InteractiveCard'

const pains = [
  'No sabes a dónde va tu dinero',
  'Gastos hormiga que te afectan',
  'Metas que nunca alcanzas',
  'Herramientas complicadas y poco intuitivas',
]

export function LandingProblem() {
  return (
    <section id="problema" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <InteractiveCard
          surface="rounded-[28px] border border-white/[0.10] bg-gradient-to-b from-white/[0.055] to-white/[0.02] p-8 sm:p-12 shadow-[0_28px_90px_rgba(0,0,0,.25)]"
        >
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr_0.75fr] lg:gap-12 lg:items-center">
            {/* Copy */}
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--success)]">
                El problema
              </p>
              <h2 className="mt-4 text-4xl font-extrabold leading-[1.14] tracking-tight sm:text-[44px]">
                No es que ganes poco. Es que no tienes{' '}
                <span className="gradient-text">claridad.</span>
              </h2>
              <p className="mt-5 leading-relaxed text-[var(--text2)]">
                Sin claridad, tu dinero se va sin que te des cuenta. MARELL te
                da visibilidad y control en tiempo real.
              </p>
            </div>

            {/* Bullets */}
            <ul className="space-y-5">
              {pains.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[var(--text)]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--coral)]/15 text-[var(--coral)]">
                    <X size={13} strokeWidth={3} />
                  </span>
                  <span className="text-base leading-snug">{p}</span>
                </li>
              ))}
            </ul>

            {/* Phone mockup */}
            <div className="relative mx-auto w-full max-w-[260px]">
              <PhoneMockup />
            </div>
          </div>
        </InteractiveCard>
      </div>
    </section>
  )
}

function PhoneMockup() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[80px] opacity-50 blur-3xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(46,196,182,.20), rgba(61,220,151,.10))',
        }}
      />

      <div className="mx-auto w-[240px] rounded-[40px] border border-white/[0.10] bg-[#0E0E0F] p-2 shadow-[0_24px_64px_-12px_rgba(0,0,0,.7)]">
        <div className="overflow-hidden rounded-[32px] bg-[#0B0B0C]">
          <div className="flex justify-center pt-1.5 pb-3">
            <div className="h-1.5 w-14 rounded-full bg-black" />
          </div>

          <div className="flex items-center justify-between px-5 text-[10px] font-medium text-[var(--text2)]">
            <span className="num">9:41</span>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
            </div>
          </div>

          <div className="px-5 pb-9 pt-10 text-center">
            <p className="text-[13px] font-medium text-[var(--text2)]">
              Martes, 30 de abril
            </p>

            <div className="mt-32 rounded-2xl border border-white/[0.10] bg-[#16161A]/95 p-3 text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,.7)] backdrop-blur-xl">
              <div className="flex items-start gap-2.5">
                <div className="grid size-7 shrink-0 place-items-center rounded-md gradient-bg">
                  <Logo variant="icon" height={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold tracking-tight">MARELL</p>
                    <p className="text-[10px] text-[var(--muted)]">Ahora</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--text)]">
                    Gastaste $1,248 más que el mes pasado en categorías
                    variables.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
