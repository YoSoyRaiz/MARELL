import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { InteractiveCard } from './InteractiveCard'

export function LandingCtaBanner() {
  return (
    <section className="relative px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <InteractiveCard
          surface="rounded-[28px] border border-white/[0.10] bg-gradient-to-b from-white/[0.055] to-white/[0.02] p-10 sm:p-14 shadow-[0_28px_90px_rgba(0,0,0,.25)]"
        >
          {/* Soft gradient halo behind */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-12 size-[560px]"
            style={{
              background:
                'radial-gradient(circle, rgba(61,220,151,.18), transparent 62%)',
            }}
          />

          <div className="relative grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-[44px]">
                Empieza hoy.{' '}
                <span className="gradient-text">Tu futuro</span>
                <br />
                te lo agradecerá.
              </h2>
              <p className="mt-5 text-[var(--text2)]">
                Prueba MARELL gratis por 14 días. Sin tarjeta de crédito.
              </p>
              <div className="mt-8">
                <Button
                  href="/signup"
                  variant="gradient"
                  size="lg"
                  iconRight={<ArrowRight size={18} strokeWidth={2.4} />}
                >
                  Empieza gratis ahora
                </Button>
              </div>
            </div>

            <div className="relative">
              <BrandCard />
            </div>
          </div>
        </InteractiveCard>
      </div>
    </section>
  )
}

function BrandCard() {
  return (
    <div className="relative mx-auto aspect-[1.6/1] w-full max-w-[320px] -rotate-[8deg] overflow-hidden rounded-[22px] border border-white/[0.12] bg-gradient-to-br from-white/[0.18] via-white/[0.04] to-[#1F3529]/40 p-7 shadow-[0_24px_64px_-12px_rgba(0,0,0,.6)] transition-transform duration-300 hover:-rotate-[6deg]">
      <div className="absolute right-7 top-7 opacity-80">
        <Logo variant="icon" height={32} />
      </div>

      <svg
        viewBox="0 0 400 200"
        className="absolute inset-x-0 bottom-0 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="cta-wave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0" />
            <stop offset="40%" stopColor="#3DDC97" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8AC926" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path
          d="M0,140 C80,90 160,180 240,130 C320,80 360,120 400,100 L400,200 L0,200 Z"
          fill="url(#cta-wave)"
          opacity="0.35"
        />
        <path
          d="M0,160 C80,120 160,200 240,150 C320,100 360,140 400,130 L400,200 L0,200 Z"
          fill="url(#cta-wave)"
          opacity="0.55"
        />
      </svg>
    </div>
  )
}
