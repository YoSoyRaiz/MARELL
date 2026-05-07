import {
  Search,
  Bell,
  LayoutDashboard,
  Sparkles,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  Repeat,
  Target,
  ArrowRight,
  Tag,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

type NavItem = {
  n: number
  label: string
  icon: typeof LayoutDashboard
  active?: boolean
}

const navItems: NavItem[] = [
  { n: 1, label: 'Resumen', icon: LayoutDashboard, active: true },
  { n: 2, label: 'Plan', icon: Sparkles },
  { n: 3, label: 'Cuentas', icon: Wallet },
  { n: 4, label: 'Análisis', icon: BarChart3 },
  { n: 5, label: 'Transacciones', icon: ArrowLeftRight },
  { n: 6, label: 'Programadas', icon: Repeat },
  { n: 7, label: 'Metas', icon: Target },
]

const kpis = [
  {
    label: 'Ingresos',
    value: '$3,200.00',
    sub: 'Este mes',
    Icon: TrendingUp,
    iconBg: 'bg-[var(--success)]/[0.12]',
    iconColor: 'text-[var(--brand-text)]',
  },
  {
    label: 'Gastos',
    value: '$1,200.00',
    sub: 'Este mes',
    Icon: TrendingDown,
    iconBg: 'bg-[var(--coral)]/[0.12]',
    iconColor: 'text-[var(--coral-text)]',
  },
  {
    label: 'Ahorros',
    value: '$800.00',
    sub: 'Cuentas de ahorro',
    Icon: PiggyBank,
    iconBg: 'bg-[#4DA8FF]/[0.12]',
    iconColor: 'text-[#4DA8FF]',
  },
  {
    label: 'Patrimonio',
    value: '$68,540',
    sub: 'Activos − deudas',
    Icon: Wallet,
    iconBg: 'bg-[#F5C842]/[0.12]',
    iconColor: 'text-[#F5C842]',
  },
] as const

type CategoryCard = {
  label: string
  spent?: string
  cap?: string
  pct?: number
  empty?: boolean
}

const categories: CategoryCard[] = [
  { label: 'Obligaciones', spent: '$0', cap: '$1,500', pct: 0 },
  { label: 'Gastos Verdaderos', empty: true },
  { label: 'Pagos de Deudas', empty: true },
  { label: 'Calidad de Vida', spent: '$400', cap: '$800', pct: 50 },
  { label: 'Solo por Diversión', empty: true },
  { label: 'Metas de Ahorro', spent: '$800', cap: '$2,000', pct: 40 },
]

const transactions = [
  { name: 'Salario', cat: 'Ingreso', amount: '+$3,000.00', tone: 'green', logo: '$', logoBg: '#1F3529' },
  { name: 'Supermercado', cat: 'Compras', amount: '-$78.45', tone: 'red', logo: '🛒', logoBg: '#2A2A2D' },
  { name: 'Netflix', cat: 'Entretenimiento', amount: '-$15.99', tone: 'red', logo: 'N', logoBg: '#E50914' },
] as const

const metas = [
  { label: 'Fondo de Emergencia', current: '$4,000', goal: '$55,500', pct: 7, type: 'Mensual' },
  { label: 'Viaje a Europa', current: '$3,900', goal: '$5,000', pct: 78, type: 'Acumulada' },
] as const

export function DashboardPreview() {
  return (
    <div className="relative w-full overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0E0E0F] shadow-[0_24px_64px_-12px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.03)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold leading-tight">
            Hola, Max <span aria-hidden>👋</span>
          </p>
          <p className="text-[9px] text-[var(--muted)]">Listo para asignar</p>
        </div>

        {/* Por asignar pill */}
        <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/[0.06] px-2.5 py-1.5 flex items-center gap-2">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-[var(--brand-text)]">
              Por asignar
            </p>
            <p className="num text-[12px] font-bold leading-tight gradient-text">
              $20,434.00
            </p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="gradient-bg rounded-md px-2 py-1 text-[9px] font-bold text-[#0B0B0C]"
          >
            Asignar
          </button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-[var(--muted)]">
            <Search size={11} />
            <span>Buscar...</span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="rounded-md p-1 text-[var(--text2)]"
          >
            <Bell size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[120px_1fr_180px] gap-0">
        {/* Sidebar */}
        <aside className="border-r border-white/[0.05] bg-[var(--s1)]/40 p-2.5">
          {/* Brand */}
          <div className="mb-4 flex items-center gap-1.5 px-1.5">
            <Logo variant="icon" height={16} />
            <span className="text-[9px] font-bold tracking-[0.2em]">MARELL</span>
          </div>

          <nav className="space-y-0.5">
            {navItems.map(({ n, label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[10px] ${
                  active
                    ? 'gradient-bg text-[#0B0B0C] font-semibold'
                    : 'text-[var(--text2)]'
                }`}
              >
                <span className={`text-[8px] tabular-nums ${active ? 'opacity-60' : 'text-[var(--muted2)]'}`}>
                  {n}.
                </span>
                <Icon size={10} strokeWidth={2.4} className="shrink-0" />
                <span className="truncate font-medium">{label}</span>
              </div>
            ))}
          </nav>

          {/* Premium upsell */}
          <div className="gradient-border mt-3 rounded-lg p-2 text-[8px]">
            <p className="font-semibold leading-tight">
              Desbloquea tu <span className="gradient-text">potencial</span>.
            </p>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="gradient-bg mt-1.5 w-full rounded-md py-1 text-[8px] font-bold text-[#0B0B0C]"
            >
              Mejorar a Premium
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="space-y-2.5 p-3">
          {/* Heading */}
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Resumen · Abril 2026
            </p>
            <h3 className="mt-1 text-[14px] font-extrabold leading-tight tracking-tight">
              Tu mes en una <span className="gradient-text">mirada</span>, Max.
            </h3>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-1.5">
            {kpis.map(({ label, value, sub, Icon, iconBg, iconColor }) => (
              <div
                key={label}
                className="rounded-md border border-white/[0.05] bg-[#141416] p-2"
              >
                <div className={`mb-1 grid size-5 place-items-center rounded ${iconBg}`}>
                  <Icon size={10} strokeWidth={2.2} className={iconColor} />
                </div>
                <p className="text-[7px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {label}
                </p>
                <p className="num mt-0.5 text-[10px] font-bold">{value}</p>
                <p className="mt-0.5 text-[7px] text-[var(--muted)]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Categorías */}
          <div className="rounded-md border border-white/[0.05] bg-[#141416]">
            <div className="flex items-baseline justify-between px-2.5 py-2 border-b border-white/[0.05]">
              <div>
                <p className="text-[10px] font-semibold">Categorías</p>
                <p className="text-[8px] text-[var(--muted)]">
                  Click en un grupo para asignar
                </p>
              </div>
              <span className="text-[8px] text-[var(--brand-text)]">Ver plan →</span>
            </div>
            <div className="grid grid-cols-3 gap-0 divide-x divide-y divide-white/[0.04]">
              {categories.map((c) => (
                <div key={c.label} className="p-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="grid size-4 place-items-center rounded bg-white/[0.04] text-[var(--text2)]">
                      <Tag size={8} strokeWidth={2} />
                    </span>
                    <span className="truncate text-[8px] font-medium">{c.label}</span>
                  </div>
                  {c.empty ? (
                    <>
                      <p className="text-[9px] font-semibold text-[var(--muted)]">
                        Aún sin asignar
                      </p>
                      <p className="text-[7px] text-[var(--brand-text)]">
                        Click para asignar →
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="num text-[10px] font-bold">{c.spent}</p>
                      <p className="text-[7px] text-[var(--muted)]">de {c.cap}</p>
                      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full gradient-bg"
                          style={{ width: `${c.pct ?? 0}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Transacciones recientes */}
          <div className="rounded-md border border-white/[0.05] bg-[#141416]">
            <div className="flex items-baseline justify-between px-2.5 py-2 border-b border-white/[0.05]">
              <p className="text-[10px] font-semibold">Transacciones recientes</p>
              <span className="text-[8px] text-[var(--brand-text)]">Ver todas →</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {transactions.map((t) => (
                <div key={t.name} className="flex items-center gap-2 px-2.5 py-1.5">
                  <div
                    className="grid size-5 shrink-0 place-items-center rounded text-[8px] font-bold text-white"
                    style={{ background: t.logoBg }}
                  >
                    {t.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-medium truncate">{t.name}</p>
                    <p className="text-[7px] text-[var(--muted)]">{t.cat}</p>
                  </div>
                  <p
                    className={`num text-[9px] font-semibold ${
                      t.tone === 'green' ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
                    }`}
                  >
                    {t.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-2.5 border-l border-white/[0.05] bg-[#0C0C0D] p-2.5">
          {/* Resumen del mes */}
          <div className="rounded-md border border-white/[0.05] bg-[#141416] p-2.5">
            <p className="text-[9px] font-semibold">Resumen de Abril</p>
            <div className="mt-2 space-y-1 text-[8px]">
              <Row label="Ingresos" value="+$3,200" tone="green" />
              <Row label="Gastos" value="-$1,200" tone="red" />
              <div className="my-1 border-t border-white/[0.06]" />
              <Row label="Disponible" value="$20,434" big />
            </div>
          </div>

          {/* Progreso del plan */}
          <div className="rounded-md border border-white/[0.05] bg-[#141416] p-2.5">
            <p className="text-[9px] font-semibold">Progreso del plan</p>
            <p className="text-[7px] text-[var(--muted)]">% gastado</p>
            <div className="mt-2 flex items-center justify-center">
              <DonutMini pct={73} />
            </div>
            <div className="mt-2 space-y-1 text-[7px]">
              <DotRow color="#3DDC97" label="Asignado" value="$5,400" />
              <DotRow color="#FF7A59" label="Gastado" value="$1,200" />
              <DotRow color="#3A3A3F" label="Restante" value="$2,000" />
            </div>
          </div>

          {/* Idea inteligente */}
          <div className="gradient-border rounded-md p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded gradient-bg">
                <Sparkles size={8} strokeWidth={2.4} className="text-[#0B0B0C]" />
              </span>
              <p className="text-[7px] font-bold uppercase tracking-wider text-[var(--brand-text)]">
                Idea inteligente
              </p>
            </div>
            <p className="mt-1.5 text-[8px] leading-snug">
              Tienes $20,434 sin asignar. Cada peso con destino te acerca a tu meta.
            </p>
          </div>

          {/* Metas */}
          <div className="rounded-md border border-white/[0.05] bg-[#141416] p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Target size={9} strokeWidth={2.2} className="text-[var(--brand-text)]" />
                <p className="text-[9px] font-semibold">Metas</p>
              </div>
              <span className="text-[7px] text-[var(--brand-text)] inline-flex items-center gap-0.5">
                Todas <ArrowRight size={7} />
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {metas.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[8px] truncate">{m.label}</span>
                    <span
                      className={`num text-[7px] tabular-nums ${
                        m.pct >= 99 ? 'text-[var(--brand-text)] font-semibold' : 'text-[var(--muted)]'
                      }`}
                    >
                      {m.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full gradient-bg"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[7px] text-[var(--muted)]">
                    <span className="num">
                      {m.current} de {m.goal}
                    </span>
                    <span className="text-[var(--muted2)]">{m.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  big,
}: {
  label: string
  value: string
  tone?: 'green' | 'red'
  big?: boolean
}) {
  const color =
    tone === 'green'
      ? 'text-[var(--brand-text)]'
      : tone === 'red'
        ? 'text-[var(--coral-text)]'
        : 'text-[var(--text)]'
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text2)]">{label}</span>
      <span
        className={`num font-semibold ${color} ${big ? 'text-[10px] gradient-text' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function DotRow({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-[var(--text2)]">
        <span className="size-1 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="num font-semibold">{value}</span>
    </div>
  )
}

function DonutMini({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={60} height={60} viewBox="0 0 60 60">
      <defs>
        <linearGradient id="dgrad-preview" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EC4B6" />
          <stop offset="60%" stopColor="#3DDC97" />
          <stop offset="100%" stopColor="#8AC926" />
        </linearGradient>
      </defs>
      <circle cx={30} cy={30} r={r} fill="none" stroke="#2A2A2D" strokeWidth={5} />
      <circle
        cx={30}
        cy={30}
        r={r}
        fill="none"
        stroke="url(#dgrad-preview)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 30 30)"
      />
      <text
        x={30}
        y={33}
        textAnchor="middle"
        className="num"
        fontSize="11"
        fontWeight="700"
        fill="#F7F7F5"
      >
        {pct}%
      </text>
    </svg>
  )
}
