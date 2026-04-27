import { ArrowRight, Eye, ArrowLeftRight, Layers, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const accounts = [
  {
    section: 'Efectivo',
    rows: [
      { icon: '💵', label: 'Efectivo', sub: '', amount: '$1,250.00', tone: 'neutral' as const },
    ],
  },
  {
    section: 'Cuentas bancarias',
    rows: [
      { icon: '🏦', label: 'Cuenta Corriente', sub: 'Banco Nacional', amount: '$4,250.00', tone: 'neutral' as const },
      { icon: '🏦', label: 'Cuenta de Ahorros', sub: 'Banco Nacional', amount: '$8,500.00', tone: 'neutral' as const },
    ],
  },
  {
    section: 'Tarjetas de crédito',
    rows: [
      { icon: '💳', label: 'Visa **** 4242',         sub: 'Crédito', amount: '-$1,250.00', tone: 'red' as const },
      { icon: '💳', label: 'Mastercard **** 8888',   sub: 'Crédito', amount: '-$750.00',   tone: 'red' as const },
    ],
  },
  {
    section: 'Inversiones',
    rows: [
      { icon: '📈', label: 'Cuenta de Inversión', sub: 'Finanzas Plus', amount: '$5,250.00', tone: 'neutral' as const },
    ],
  },
  {
    section: 'Préstamos',
    rows: [
      { icon: '🏠', label: 'Préstamo Personal', sub: 'Banco Nacional', amount: '-$2,066.00', tone: 'red' as const },
    ],
  },
]

const features = [
  { icon: Eye,            title: 'Visualiza el saldo real',  desc: 'de todas tus cuentas' },
  { icon: ArrowLeftRight, title: 'Sigue tus movimientos',    desc: 'en tiempo real' },
  { icon: Layers,         title: 'Organiza por tipo',        desc: 'de cuenta' },
  { icon: Lightbulb,      title: 'Toma decisiones',          desc: 'con claridad' },
]

const donutSegments = [
  { color: '#3DDC97', label: 'Efectivo',         pct: 6,   value: '$1,250' },
  { color: '#2EC4B6', label: 'Cuentas bancarias', pct: 62, value: '$12,750' },
  { color: '#F5C842', label: 'Inversiones',      pct: 24,  value: '$5,250' },
  { color: '#FF7A59', label: 'Tarjetas de crédito', pct: -10, value: '-$2,000' },
  { color: '#FF4F6A', label: 'Préstamos',        pct: -12, value: '-$2,066' },
]

export function LandingAccounts() {
  return (
    <section id="producto" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:items-center">
          {/* Left copy */}
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--success)]">
              Control total
            </p>
            <h2 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Controla todas tus cuentas{' '}
              <span className="gradient-text">en un solo lugar</span>
            </h2>
            <p className="mt-5 leading-relaxed text-[var(--text2)]">
              MARELL te permite ver y gestionar todas tus cuentas financieras: efectivo,
              tarjetas, inversiones, préstamos y más. Todo conectado, todo bajo control.
            </p>

            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6">
              {features.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[var(--success)]">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{title}</p>
                    <p className="mt-0.5 text-sm text-[var(--text2)]">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Button
                href="/signup"
                variant="outline"
                size="md"
                iconRight={<ArrowRight size={16} strokeWidth={2.4} />}
              >
                Más información
              </Button>
            </div>
          </div>

          {/* Right: accounts panel */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[32px] opacity-40 blur-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(46,196,182,.16), rgba(61,220,151,.08))',
              }}
            />
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0E0E0F] p-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,.6)]">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                {/* Accounts list */}
                <div>
                  <div className="mb-4 flex items-baseline justify-between">
                    <h3 className="text-base font-bold">Cuentas</h3>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Saldo total
                      </p>
                      <p className="num text-xl font-bold">$20,434.00</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {accounts.map((sec) => (
                      <div key={sec.section}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                          {sec.section}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {sec.rows.map((r) => (
                            <div
                              key={r.label}
                              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.025]"
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/5 text-sm">
                                {r.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{r.label}</p>
                                {r.sub && (
                                  <p className="text-xs text-[var(--muted)]">{r.sub}</p>
                                )}
                              </div>
                              <p
                                className={`num text-sm font-semibold ${
                                  r.tone === 'red' ? 'text-[var(--coral)]' : ''
                                }`}
                              >
                                {r.amount}
                              </p>
                              <ArrowRight size={12} className="text-[var(--muted)]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut breakdown */}
                <div className="flex flex-col items-center justify-center">
                  <Donut />
                  <ul className="mt-6 w-full space-y-2 text-sm">
                    {donutSegments.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--text2)]">
                          <span className="size-2 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="num text-xs font-semibold">
                          {s.pct >= 0 ? `${s.pct}%` : `${s.pct}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Donut() {
  // Simple stacked-arcs donut showing the same gradient family
  const segments = [
    { color: '#3DDC97', value: 6 },
    { color: '#2EC4B6', value: 62 },
    { color: '#F5C842', value: 24 },
    { color: '#FF7A59', value: 5 },
    { color: '#FF4F6A', value: 3 },
  ]
  const total = segments.reduce((a, b) => a + b.value, 0)
  const radius = 72
  const stroke = 18
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="relative">
      <svg width={200} height={200} viewBox="0 0 200 200">
        <circle
          cx={100}
          cy={100}
          r={radius}
          fill="none"
          stroke="#1A1A1C"
          strokeWidth={stroke}
        />
        {segments.map((s, i) => {
          const length = (s.value / total) * circumference
          const dasharray = `${length} ${circumference - length}`
          const dashoffset = -offset
          offset += length
          return (
            <circle
              key={i}
              cx={100}
              cy={100}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 100 100)"
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Activos</p>
          <p className="num text-xl font-bold">$19,250.00</p>
        </div>
      </div>
    </div>
  )
}
