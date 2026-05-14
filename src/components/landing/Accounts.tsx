import { ArrowRight, Eye, ArrowLeftRight, Layers, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InteractiveCard } from './InteractiveCard'

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
      { icon: '💳', label: 'Visa **** 4242', sub: 'Crédito', amount: '-$1,250.00', tone: 'red' as const },
      { icon: '💳', label: 'Mastercard **** 8888', sub: 'Crédito', amount: '-$750.00', tone: 'red' as const },
    ],
  },
  {
    section: 'Inversiones',
    rows: [
      { icon: '📈', label: 'Cuenta de Inversión', sub: 'Finanzas Plus', amount: '$5,250.00', tone: 'neutral' as const },
    ],
  },
]

const features = [
  { icon: Eye, title: 'Visualiza el saldo real', desc: 'de todas tus cuentas' },
  { icon: ArrowLeftRight, title: 'Sigue tus movimientos', desc: 'en tiempo real' },
  { icon: Layers, title: 'Organiza por tipo', desc: 'de cuenta' },
  { icon: Lightbulb, title: 'Toma decisiones', desc: 'con claridad' },
]

const donutSegments = [
  { color: '#3DDC97', label: 'Efectivo', pct: 6, value: '$1,250' },
  { color: '#2EC4B6', label: 'Cuentas bancarias', pct: 62, value: '$12,750' },
  { color: '#F5C842', label: 'Inversiones', pct: 24, value: '$5,250' },
  { color: '#FF7A59', label: 'Tarjetas', pct: -10, value: '-$2,000' },
]

export function LandingAccounts() {
  return (
    <section id="producto" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <InteractiveCard
          surface="rounded-[28px] landing-card p-8 sm:p-12"
        >
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.2fr] lg:gap-14 lg:items-center">
            {/* Left copy */}
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-text)]">
                Control total
              </p>
              <h2 className="mt-4 text-4xl font-extrabold leading-[1.14] tracking-tight sm:text-[44px]">
                Controla todas tus{' '}
                <span className="gradient-text">cuentas en un solo lugar</span>
              </h2>
              <p className="mt-5 leading-relaxed text-[var(--text2)]">
                MARELL te permite ver y gestionar efectivo, tarjetas, inversiones,
                préstamos y más. Todo organizado, todo bajo control.
              </p>

              {/* 2x2 feature grid */}
              <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {features.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--success)]/[0.10] text-[var(--brand-text)]">
                      <Icon size={16} strokeWidth={2.2} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold leading-tight">
                        {title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--text2)]">
                        {desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-9">
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

            {/* Right: accounts UI inside an inner panel. Surface flips
                with theme so the panel stays distinguishable from the
                outer card on both light and dark backgrounds. */}
            <div className="rounded-[24px] border border-[var(--border2)] bg-[var(--overlay-1)] p-5 backdrop-blur-sm sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                {/* Accounts list */}
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="text-base font-bold">Cuentas</h3>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        Saldo total
                      </p>
                      <p className="num text-lg font-bold">$20,434.00</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {accounts.map((sec) => (
                      <div key={sec.section}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                          {sec.section}
                        </p>
                        <div className="mt-1.5 divide-y divide-[var(--border)]">
                          {sec.rows.map((r) => (
                            <div
                              key={r.label}
                              className="flex items-center gap-3 px-1 py-2.5"
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--success)]/[0.10] text-sm">
                                {r.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">
                                  {r.label}
                                </p>
                                {r.sub && (
                                  <p className="text-[11px] text-[var(--muted)]">
                                    {r.sub}
                                  </p>
                                )}
                              </div>
                              <p
                                className={`num text-[13px] font-semibold ${
                                  r.tone === 'red' ? 'text-[var(--coral-text)]' : ''
                                }`}
                              >
                                {r.amount}
                              </p>
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
                  <ul className="mt-5 w-full space-y-2.5 text-[13px]">
                    {donutSegments.map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex items-center gap-2 text-[var(--text2)]">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.label}
                        </span>
                        <span className="num text-[12px] font-semibold">
                          {s.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </InteractiveCard>
      </div>
    </section>
  )
}

function Donut() {
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
          stroke="var(--s3)"
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
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Activos
          </p>
          <p className="num text-lg font-bold">$19,250.00</p>
        </div>
      </div>
    </div>
  )
}
