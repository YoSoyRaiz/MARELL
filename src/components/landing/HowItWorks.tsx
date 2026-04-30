import { Plus } from 'lucide-react'
import { InteractiveCard } from './InteractiveCard'

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--success)]">
            Cómo funciona
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Tres pasos simples para{' '}
            <span className="gradient-text">tomar el control</span>
          </h2>
        </div>

        {/* Steps with vertical dividers */}
        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-0">
          <Step
            n={1}
            title="Asigna tu dinero"
            desc="Distribuye tu dinero en categorías que importan para ti y tus metas."
            divider
          >
            <AssignVisual />
          </Step>
          <Step
            n={2}
            title="Rastrea en tiempo real"
            desc="Registra tus movimientos y mantén siempre clara tu situación."
            divider
          >
            <TrackVisual />
          </Step>
          <Step
            n={3}
            title="Alcanza tus metas"
            desc="Visualiza tu progreso y ajusta tu plan para lograr lo que quieres."
          >
            <GoalVisual />
          </Step>
        </div>
      </div>
    </section>
  )
}

function Step({
  n,
  title,
  desc,
  divider,
  children,
}: {
  n: number
  title: string
  desc: string
  divider?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`relative flex flex-col items-center px-4 text-center lg:px-9 ${
        divider
          ? 'lg:before:absolute lg:before:right-0 lg:before:top-12 lg:before:h-[230px] lg:before:w-px lg:before:bg-gradient-to-b lg:before:from-transparent lg:before:via-white/15 lg:before:to-transparent'
          : ''
      }`}
    >
      <div
        className="mb-6 grid size-11 place-items-center rounded-full border border-[var(--success)]/30 text-base font-bold"
        style={{
          background:
            'radial-gradient(circle, rgba(114,223,53,.32), rgba(24,196,189,.10))',
        }}
      >
        {n}
      </div>
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-[var(--text2)]">
        {desc}
      </p>
      <div className="mt-7 w-full max-w-[260px]">{children}</div>
    </div>
  )
}

function AssignVisual() {
  const items = [
    { icon: '🏠', label: 'Gastos fijos', amount: '$1,200.00' },
    { icon: '🛒', label: 'Necesidades', amount: '$800.00' },
    { icon: '🐷', label: 'Ahorros', amount: '$800.00', highlight: true },
  ]
  return (
    <InteractiveCard
      surface="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 text-left"
    >
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        Asignar disponible
      </p>
      <p className="num mt-1 text-2xl font-bold">$20,434.00</p>
      <div className="mt-4 space-y-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`flex items-center gap-3 rounded-lg border border-white/[0.05] p-2.5 ${
              it.highlight ? 'bg-white/[0.04]' : 'bg-white/[0.015]'
            }`}
          >
            <span className="grid size-7 place-items-center rounded-md bg-white/5 text-sm">
              {it.icon}
            </span>
            <span className="flex-1 text-[13px] font-medium">{it.label}</span>
            <span className="num text-[13px] font-semibold">{it.amount}</span>
            <button
              type="button"
              tabIndex={-1}
              className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--success)]/15 text-[var(--success)]"
              aria-hidden
            >
              <Plus size={12} strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>
    </InteractiveCard>
  )
}

function TrackVisual() {
  const txns = [
    { name: 'Supermercado', cat: 'Compras', amount: '-$78.65', tone: 'red', logo: '🛒', logoBg: '#2A2A2D' },
    { name: 'Salario', cat: 'Ingreso', amount: '+$3,000.00', tone: 'green', logo: '$', logoBg: '#1F3529' },
    { name: 'Spotify', cat: 'Entretenimiento', amount: '-$9.99', tone: 'red', logo: 'S', logoBg: '#1DB954' },
  ] as const
  return (
    <div className="space-y-2 text-left">
      {txns.map((t) => (
        <InteractiveCard
          key={t.name}
          surface="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
              style={{ background: t.logoBg }}
            >
              {t.logo}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{t.name}</p>
              <p className="text-xs text-[var(--muted)]">{t.cat}</p>
            </div>
            <p
              className={`num text-sm font-semibold ${
                t.tone === 'green' ? 'text-[var(--success)]' : 'text-[var(--coral)]'
              }`}
            >
              {t.amount}
            </p>
          </div>
        </InteractiveCard>
      ))}
    </div>
  )
}

function GoalVisual() {
  return (
    <InteractiveCard
      surface="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 text-center"
    >
      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
        Meta: Viaje a Europa
      </p>
      <p className="num mt-3 text-5xl font-extrabold tracking-tight">
        78<span className="text-[var(--success)]">%</span>
      </p>
      <p className="num mt-1 text-sm text-[var(--text2)]">$3,900 / $5,000</p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2EC4B6] via-[#3DDC97] to-[#8AC926]"
          style={{ width: '78%' }}
        />
      </div>
    </InteractiveCard>
  )
}
