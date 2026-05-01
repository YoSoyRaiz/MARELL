import Image from 'next/image'
import { ArrowRight, Play, Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InteractiveCard } from './InteractiveCard'

const trustSignals = [
  'Gratis por 31 días',
  'Sin tarjeta de crédito',
  'Cancela cuando quieras',
]

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 70% 0%, rgba(61,220,151,.12), transparent 60%), radial-gradient(ellipse 50% 40% at 20% 30%, rgba(46,196,182,.06), transparent 60%)',
        }}
      />
      <div className="grid-fade absolute inset-0 -z-10" aria-hidden />

      {/* Left side stays inside the 1400px content rail; the right
          side bleeds to the viewport edge so the dashboard screenshot
          fills the full visual area on desktop. */}
      <div className="grid gap-12 pb-24 pt-12 lg:pt-16 lg:grid-cols-[0.6fr_1.4fr] lg:gap-12 lg:items-stretch">
        {/* Left: copy */}
        <div className="px-6 lg:pl-[max(24px,calc((100vw-1400px)/2))] lg:pr-0">
          <div className="max-w-xl">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-[var(--text2)]">
              <span className="size-2 rounded-full bg-[var(--success)] shadow-[0_0_18px_rgba(61,220,151,.75)]" />
              La app de finanzas personales que te da claridad
            </span>

            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[56px] lg:text-[58px]">
              Control total
              <br />
              de tu dinero.
              <br />
              <span className="gradient-text whitespace-nowrap">Sin complicaciones.</span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[var(--text2)]">
              MARELL te ayuda a asignar, rastrear y optimizar cada peso para que
              alcances tus metas más rápido.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                href="/signup"
                variant="gradient"
                size="lg"
                iconRight={<ArrowRight size={18} strokeWidth={2.4} />}
              >
                Empieza gratis
              </Button>
              <Button
                href="#como-funciona"
                variant="outline"
                size="lg"
                iconRight={<Play size={14} strokeWidth={2.4} fill="currentColor" />}
              >
                Ver cómo funciona
              </Button>
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-[var(--text2)]">
              {trustSignals.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[
                  { initials: 'MR', from: '#2EC4B6', to: '#3DDC97' },
                  { initials: 'AL', from: '#3DDC97', to: '#8AC926' },
                  { initials: 'JS', from: '#1F3529', to: '#3DDC97' },
                  { initials: 'NP', from: '#2EC4B6', to: '#1F3529' },
                ].map((a, i) => (
                  <div
                    key={i}
                    className="grid size-9 place-items-center rounded-full border-2 border-[#0B0B0C] text-[10px] font-bold text-[#0B0B0C]"
                    style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
                  >
                    {a.initials}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <p className="font-semibold">
                  +10,000 personas <span className="font-normal text-[var(--text2)]">ya están</span>
                </p>
                <p className="text-[var(--text2)]">transformando sus finanzas</p>
              </div>
              <div className="hidden h-9 w-px bg-white/10 sm:block" />
              <div className="hidden items-center gap-1.5 sm:flex">
                <div className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={14} className="fill-[#F5C842] text-[#F5C842]" />
                  ))}
                </div>
                <span className="text-sm font-medium">4.9/5</span>
                <span className="text-sm text-[var(--muted)]">en calificaciones</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right: real product screenshot. Bleeds to the viewport edge
            on desktop so the image dominates the hero. Replace
            /public/landing/dashboard-hero.jpg with a fresh capture
            whenever the dashboard's UI changes meaningfully. */}
        <div className="relative px-6 lg:px-0 lg:pr-0 flex items-center">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[32px] opacity-60 blur-3xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(46,196,182,.18), rgba(61,220,151,.12), rgba(138,201,38,.06))',
            }}
          />
          <InteractiveCard
            hue="green"
            surface="rounded-l-[28px] lg:rounded-r-none border border-white/[0.13] lg:border-r-0 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-2 shadow-[0_30px_80px_rgba(0,0,0,.45)] w-full"
          >
            <Image
              src="/landing/dashboard-hero.jpg"
              alt="Dashboard de MARELL — vista de Resumen con KPIs, categorías y transacciones"
              width={2400}
              height={1298}
              priority
              sizes="(min-width: 1024px) 65vw, 100vw"
              className="rounded-l-[22px] lg:rounded-r-none w-full h-auto"
            />
          </InteractiveCard>
        </div>
      </div>
    </section>
  )
}
