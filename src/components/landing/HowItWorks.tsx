import { Plus } from 'lucide-react'

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

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <Step
            n={1}
            title="Asigna tu dinero"
            desc="Distribuye tu dinero en categorías que importan para ti y tus metas."
          >
            <AssignVisual />
          </Step>
          <Step
            n={2}
            title="Rastrea en tiempo real"
            desc="MARELL registra tus movimientos automáticamente y te mantiene siempre al día."
          >
            <TrackVisual />
          </Step>
          <Step
            n={3}
            title="Alcanza tus metas"
            desc="Visualiza tu progreso y ajusta tu plan para lograr lo que realmente quieres."
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
  children,
}: {
  n: number
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[var(--s1)] p-7 transition-colors hover:border-white/[0.12]">
      <div className="flex items-start gap-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-bold text-[var(--text2)]">
          {n}
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text2)]">{desc}</p>
        </div>
      </div>
      <div className="mt-7">{children}</div>
    </div>
  )
}

function AssignVisual() {
  const items = [
    { icon: '🏠', label: 'Gastos fijos',  amount: '$1,200.00' },
    { icon: '🛒', label: 'Necesidades',   amount: '$800.00' },
    { icon: '🐷', label: 'Ahorros',       amount: '$800.00', highlight: true },
  ]
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E0F] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
        Asignar disponible
      </p>
      <p className="num mt-1 text-2xl font-bold">$20,434.00</p>
      <div className="mt-4 space-y-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`flex items-center gap-3 rounded-lg border border-white/[0.05] p-2.5 transition-colors ${
              it.highlight ? 'bg-white/[0.04]' : 'bg-white/[0.015]'
            }`}
          >
            <span className="grid size-7 place-items-center rounded-md bg-white/5 text-sm">
              {it.icon}
            </span>
            <span className="flex-1 text-sm font-medium">{it.label}</span>
            <span className="num text-sm font-semibold">{it.amount}</span>
            <button className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--success)]/15 text-[var(--success)]">
              <Plus size={12} strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrackVisual() {
  const txns = [
    { name: 'Supermercado', cat: 'Compras',       amount: '-$78.65',     tone: 'red',   logo: '🛒', logoBg: '#2A2A2D' },
    { name: 'Salario',      cat: 'Ingreso',       amount: '+$3,000.00',  tone: 'green', logo: '$',  logoBg: '#1F3529' },
    { name: 'Spotify',      cat: 'Entretenimiento', amount: '-$9.99',    tone: 'red',   logo: 'S',  logoBg: '#1DB954' },
  ] as const
  return (
    <div className="space-y-2">
      {txns.map((t) => (
        <div
          key={t.name}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0E0E0F] p-3"
        >
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
      ))}
    </div>
  )
}

function GoalVisual() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E0F] p-6 text-center">
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
    </div>
  )
}
