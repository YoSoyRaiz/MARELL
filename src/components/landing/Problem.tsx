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
          surface="rounded-[28px] landing-card p-8 sm:p-12"
        >
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr_0.75fr] lg:gap-12 lg:items-center">
            {/* Copy */}
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-text)]">
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
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--coral)]/15 text-[var(--coral-text)]">
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

      {/* The phone is always rendered in dark UI to look like an
          actual device screen; we use raw hex (not theme tokens) so
          the lockscreen stays dark even in light mode — same logic
          as the hero dashboard preview. */}
      <div className="mx-auto w-[240px] rounded-[40px] border border-black/30 bg-[#0E0E0F] p-2 shadow-[0_24px_64px_-12px_rgba(0,0,0,.55)]">
        <div className="overflow-hidden rounded-[32px] bg-[#0B0B0C] text-white">
          <div className="flex justify-center pt-1.5 pb-3">
            <div className="h-1.5 w-14 rounded-full bg-black" />
          </div>

          <div className="flex items-center justify-between px-5 text-tiny font-medium text-[#C8C8C0]">
            <span className="num">9:41</span>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
            </div>
          </div>

          <div className="px-5 pb-9 pt-10 text-center">
            <p className="text-body-sm font-medium text-[#C8C8C0]">
              Martes, 30 de abril
            </p>

            <div className="mt-32 rounded-2xl border border-white/[0.10] bg-[#16161A]/95 p-3 text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,.7)] backdrop-blur-xl">
              <div className="flex items-start gap-2.5">
                <div className="grid size-7 shrink-0 place-items-center rounded-md gradient-bg">
                  <Logo variant="icon" height={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-eyebrow font-bold tracking-tight">MARELL</p>
                    <p className="text-tiny text-[#8A8A82]">Ahora</p>
                  </div>
                  <p className="mt-1 text-eyebrow leading-snug text-white">
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
