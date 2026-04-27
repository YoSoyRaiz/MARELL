import { X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const pains = [
  'No sabes a dónde va tu dinero',
  'Gastos hormiga que te afectan',
  'Metas que nunca alcanzas',
  'Herramientas complicadas y poco intuitivas',
]

export function LandingProblem() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left: copy */}
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--success)]">
              El problema
            </p>
            <h2 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              No es que ganes poco.
              <br />
              Es que no tienes <span className="gradient-text">claridad</span>.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-[var(--text2)]">
              Sin claridad, tu dinero se va sin que te des cuenta. MARELL te da
              la visibilidad y control en tiempo real.
            </p>

            <ul className="mt-10 space-y-5">
              {pains.map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--coral)]/15 text-[var(--coral)]">
                    <X size={13} strokeWidth={3} />
                  </span>
                  <span className="text-base text-[var(--text)]">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: phone mockup */}
          <div className="relative mx-auto w-full max-w-sm">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[80px] opacity-50 blur-3xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(46,196,182,.20), rgba(61,220,151,.10))',
        }}
      />

      <div className="mx-auto w-[280px] rounded-[44px] border border-white/[0.10] bg-[#0E0E0F] p-2 shadow-[0_24px_64px_-12px_rgba(0,0,0,.7)]">
        <div className="overflow-hidden rounded-[36px] bg-[#0B0B0C]">
          {/* Notch */}
          <div className="flex justify-center pt-1.5 pb-3">
            <div className="h-1.5 w-16 rounded-full bg-black" />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 text-[10px] font-medium text-[var(--text2)]">
            <span className="num">9:41</span>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
              <span className="size-2 rounded-sm border border-white/30" />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-10 pt-12 text-center">
            <p className="text-[13px] font-medium text-[var(--text2)]">
              Martes, 30 de abril
            </p>

            {/* Notification */}
            <div className="mt-44 rounded-2xl border border-white/[0.10] bg-[#16161A]/95 p-3.5 text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,.7)] backdrop-blur-xl">
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
                    Gastaste $1,248 más que el mes pasado en categorías variables.
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
