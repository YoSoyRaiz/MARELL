import {
  Search,
  Bell,
  Home,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  Target,
  ArrowRight,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Sparkline } from './Sparkline'

const navItems = [
  { n: '1', label: 'Resumen', icon: Home, active: true },
  { n: '2', label: 'Cuentas', icon: Wallet, active: false },
  { n: '3', label: 'Análisis', icon: BarChart3, active: false },
  { n: '4', label: 'Transacciones', icon: ArrowLeftRight, active: false },
  { n: '5', label: 'Metas', icon: Target, active: false },
]

const kpis = [
  {
    label: 'Ingresos',
    value: '$3,200.00',
    delta: '+12%',
    tone: 'green' as const,
    points: [4, 6, 5, 7, 6, 8, 7, 9, 8, 10],
    icon: '💰',
  },
  {
    label: 'Gastos',
    value: '$1,200.00',
    delta: '+8%',
    tone: 'red' as const,
    points: [5, 4, 6, 5, 7, 6, 8, 7, 6, 8],
    icon: '🛒',
  },
  {
    label: 'Ahorros',
    value: '$800.00',
    delta: '+15%',
    tone: 'green' as const,
    points: [3, 4, 5, 6, 5, 7, 8, 9, 10, 12],
    icon: '🐷',
  },
  {
    label: 'Patrimonio',
    value: '$68,540',
    delta: '+9%',
    tone: 'violet' as const,
    points: [60, 62, 61, 63, 64, 65, 66, 67, 68, 68.5],
    icon: '💼',
  },
]

const categories = [
  { icon: '🏠', label: 'Gastos fijos',  spent: '$1,200', cap: '$1,500', pct: 80 },
  { icon: '🛒', label: 'Necesidades',   spent: '$800',   cap: '$1,200', pct: 67 },
  { icon: '🍿', label: 'Estilo de vida', spent: '$400',   cap: '$800',   pct: 50 },
  { icon: '💎', label: 'Ahorros',       spent: '$800',   cap: '$2,000', pct: 40 },
  { icon: '📚', label: 'Educación',     spent: '$200',   cap: '$500',   pct: 40 },
]

const transactions = [
  { name: 'Amazon',       cat: 'Compras',         date: '30 Abr, 2026', amount: '-$120.00',   tone: 'red',   logo: 'A', logoBg: '#FF9900' },
  { name: 'Salario',      cat: 'Ingreso',         date: '30 Abr, 2026', amount: '+$3,000.00', tone: 'green', logo: '$', logoBg: '#1F3529' },
  { name: 'Netflix',      cat: 'Entretenimiento', date: '29 Abr, 2026', amount: '-$15.99',    tone: 'red',   logo: 'N', logoBg: '#E50914' },
  { name: 'Starbucks',    cat: 'Compras',         date: '28 Abr, 2026', amount: '-$5.50',     tone: 'red',   logo: 'S', logoBg: '#006241' },
  { name: 'Supermercado', cat: 'Compras',         date: '27 Abr, 2026', amount: '-$78.45',    tone: 'red',   logo: '🛒', logoBg: '#2A2A2D' },
] as const

export function DashboardPreview() {
  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0E0E0F] shadow-[0_24px_64px_-12px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.03)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Logo variant="icon" height={22} />
          <span className="text-[13px] font-bold tracking-tight">MARELL</span>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-[var(--muted)] max-w-[260px]">
          <Search size={12} />
          <span>Buscar...</span>
        </div>
        <button className="rounded-md p-1.5 text-[var(--text2)] hover:bg-white/5">
          <Bell size={14} />
        </button>
      </div>

      <div className="grid grid-cols-[140px_1fr_220px] gap-0">
        {/* Sidebar */}
        <aside className="border-r border-white/[0.05] p-3">
          <div className="mb-3">
            <p className="px-2 text-[10px] font-bold tracking-wide text-[var(--text)]">Hola, Max 👋</p>
            <p className="mt-2 px-2 text-[9px] uppercase tracking-wider text-[var(--muted)]">Asignar disponible</p>
            <p className="num mt-0.5 px-2 text-[15px] font-bold">$20,434</p>
            <div className="mt-1 flex items-center gap-1 px-2 text-[9px] text-[var(--success)]">
              <span className="size-1.5 rounded-full bg-[var(--success)]" />
              <span>Listo para asignar</span>
            </div>
          </div>
          <nav className="space-y-0.5">
            {navItems.map(({ n, label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                  active
                    ? 'gradient-bg text-[#0B0B0C] font-semibold'
                    : 'text-[var(--text2)]'
                }`}
              >
                <Icon size={11} strokeWidth={2.4} />
                <span className="font-medium">{n}. {label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main column */}
        <div className="space-y-3 p-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2.5">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-lg border border-white/[0.05] bg-[#141416] p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="grid size-5 place-items-center rounded-md bg-white/5 text-[10px]">
                    {k.icon}
                  </span>
                </div>
                <p className="text-[8px] uppercase tracking-wide text-[var(--muted)]">{k.label}</p>
                <p className="num mt-0.5 text-[12px] font-bold">{k.value}</p>
                <div className="mt-1.5 -mx-1">
                  <Sparkline points={k.points} tone={k.tone} width={120} height={20} />
                </div>
                <p className={`mt-1 text-[8px] font-medium ${k.tone === 'green' || k.tone === 'violet' ? 'text-[var(--success)]' : 'text-[var(--coral)]'}`}>
                  ↑ {k.delta} <span className="text-[var(--muted)]">vs. mes pasado</span>
                </p>
              </div>
            ))}
          </div>

          {/* Categories */}
          <div className="rounded-lg border border-white/[0.05] bg-[#141416] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold">Categorías</p>
              <span className="text-[9px] text-[var(--success)]">Ver todas</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {categories.map((c) => (
                <div key={c.label} className="rounded-md bg-white/[0.02] p-2">
                  <div className="flex items-center gap-1 text-[9px] text-[var(--text2)]">
                    <span>{c.icon}</span>
                    <span className="truncate">{c.label}</span>
                  </div>
                  <p className="num mt-1 text-[10px] font-bold">{c.spent}</p>
                  <p className="text-[8px] text-[var(--muted)]">de {c.cap}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2EC4B6] via-[#3DDC97] to-[#8AC926]"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-right text-[8px] text-[var(--muted)]">{c.pct}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-lg border border-white/[0.05] bg-[#141416] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold">Transacciones recientes</p>
              <span className="text-[9px] text-[var(--success)]">Ver todas</span>
            </div>
            <div className="space-y-1.5">
              {transactions.map((t) => (
                <div key={t.name + t.date} className="flex items-center gap-2.5">
                  <div
                    className="grid size-5 shrink-0 place-items-center rounded-md text-[8px] font-bold text-white"
                    style={{ background: t.logoBg }}
                  >
                    {t.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium truncate">{t.name}</p>
                    <p className="text-[8px] text-[var(--muted)]">{t.cat}</p>
                  </div>
                  <p className="text-[9px] text-[var(--muted)]">{t.date}</p>
                  <p className={`num w-20 text-right text-[10px] font-semibold ${t.tone === 'green' ? 'text-[var(--success)]' : 'text-[var(--coral)]'}`}>
                    {t.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-3 border-l border-white/[0.05] bg-[#0C0C0D] p-3">
          {/* Asignar dinero CTA */}
          <button className="gradient-bg w-full rounded-lg py-2 text-[10px] font-bold text-[#0B0B0C] flex items-center justify-center gap-1">
            Asignar dinero <ArrowRight size={11} />
          </button>

          <div className="rounded-lg border border-white/[0.05] bg-[#141416] p-2.5">
            <p className="text-[9px] font-semibold">Resumen del mes</p>
            <div className="mt-2 space-y-1 text-[9px]">
              <Row label="Mes pasado" value="$2,150" muted />
              <Row label="Ingresos" value="+$3,200" tone="green" />
              <Row label="Gastos" value="-$1,200" tone="red" />
              <div className="my-1 border-t border-white/[0.06]" />
              <Row label="Disponible" value="$20,434" big />
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.05] bg-[#141416] p-2.5">
            <p className="text-[9px] font-semibold">Progreso</p>
            <div className="mt-2 flex items-center justify-center">
              <DonutMini pct={73} />
            </div>
            <div className="mt-2 space-y-1 text-[8px]">
              <DotRow color="#3DDC97" label="Gastado" value="$1,200" />
              <DotRow color="#2EC4B6" label="Asignado" value="$5,400" />
              <DotRow color="#3A3A3F" label="Restante" value="$2,000" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value, tone, muted, big }: { label: string; value: string; tone?: 'green' | 'red'; muted?: boolean; big?: boolean }) {
  const color =
    tone === 'green' ? 'text-[var(--success)]' :
    tone === 'red'   ? 'text-[var(--coral)]'   :
    muted            ? 'text-[var(--muted)]'   :
                       'text-[var(--text)]'
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text2)]">{label}</span>
      <span className={`num font-semibold ${color} ${big ? 'text-[10px]' : ''}`}>{value}</span>
    </div>
  )
}

function DotRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[var(--text2)]">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="num font-semibold">{value}</span>
    </div>
  )
}

function DonutMini({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={68} height={68} viewBox="0 0 68 68">
      <defs>
        <linearGradient id="dgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EC4B6" />
          <stop offset="60%" stopColor="#3DDC97" />
          <stop offset="100%" stopColor="#8AC926" />
        </linearGradient>
      </defs>
      <circle cx={34} cy={34} r={r} fill="none" stroke="#2A2A2D" strokeWidth={6} />
      <circle
        cx={34}
        cy={34}
        r={r}
        fill="none"
        stroke="url(#dgrad)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 34 34)"
      />
      <text x={34} y={37} textAnchor="middle" className="num" fontSize="13" fontWeight="700" fill="#F7F7F5">
        {pct}%
      </text>
    </svg>
  )
}
