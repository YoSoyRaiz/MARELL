import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

export function LandingCtaBanner() {
  return (
    <section className="relative px-6 py-16">
      <div
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0E0E0F] p-10 sm:p-14"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at top right, rgba(61,220,151,.10), transparent 60%)',
        }}
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
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

          {/* Card visual */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(61,220,151,.18), transparent 65%)',
              }}
            />
            <BrandCard />
          </div>
        </div>
      </div>
    </section>
  )
}

function BrandCard() {
  return (
    <div className="relative ml-auto aspect-[1.6/1] w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/[0.10] bg-gradient-to-br from-[#16161A] via-[#0E0E0F] to-[#1F3529] p-7 shadow-[0_24px_64px_-12px_rgba(0,0,0,.6)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <Logo variant="icon" height={28} />
      </div>

      {/* Wave */}
      <svg
        viewBox="0 0 400 200"
        className="absolute inset-x-0 bottom-0 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0.0" />
            <stop offset="40%" stopColor="#3DDC97" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8AC926" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path
          d="M0,140 C80,90 160,180 240,130 C320,80 360,120 400,100 L400,200 L0,200 Z"
          fill="url(#wave-grad)"
          opacity="0.35"
        />
        <path
          d="M0,160 C80,120 160,200 240,150 C320,100 360,140 400,130 L400,200 L0,200 Z"
          fill="url(#wave-grad)"
          opacity="0.55"
        />
      </svg>
    </div>
  )
}
