import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  BarChart3,
  Repeat,
  Target,
  Users,
  Calculator,
  Scale,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/actions'

interface MoreItem {
  id: string
  label: string
  description: string
  href: string
  icon: typeof Wallet
  iconBg: string
  iconColor: string
}

const ITEMS: MoreItem[] = [
  {
    id: 'cuentas',
    label: 'Cuentas',
    description: 'Maneja efectivo, tarjetas y préstamos',
    href: '/app/cuentas',
    icon: Wallet,
    iconBg: 'bg-[rgba(61,220,151,0.10)]',
    iconColor: 'text-[var(--brand-text)]',
  },
  {
    id: 'reconciliar',
    label: 'Reconciliar',
    description: 'Cuadra tus cuentas con el banco',
    href: '/app/cuentas',
    icon: Scale,
    iconBg: 'bg-[rgba(77,168,255,0.10)]',
    iconColor: 'text-[var(--info-text)]',
  },
  {
    id: 'analisis',
    label: 'Análisis',
    description: 'Reportes, tendencias y patrimonio',
    href: '/app/analisis',
    icon: BarChart3,
    iconBg: 'bg-[rgba(245,200,66,0.10)]',
    iconColor: 'text-[var(--warn-text)]',
  },
  {
    id: 'programadas',
    label: 'Programadas',
    description: 'Recurrencias automáticas',
    href: '/app/programadas',
    icon: Repeat,
    iconBg: 'bg-[rgba(46,196,182,0.10)]',
    iconColor: 'text-[var(--brand)]',
  },
  {
    id: 'metas',
    label: 'Metas',
    description: 'Hacia dónde va tu esfuerzo',
    href: '/app/metas',
    icon: Target,
    iconBg: 'bg-[rgba(61,220,151,0.10)]',
    iconColor: 'text-[var(--brand-text)]',
  },
  {
    id: 'familia',
    label: 'Familia',
    description: 'Comparte tu presupuesto',
    href: '/app/familia',
    icon: Users,
    iconBg: 'bg-[rgba(255,122,89,0.10)]',
    iconColor: 'text-[var(--coral-text)]',
  },
  {
    id: 'calculos',
    label: 'Cálculos RD',
    description: 'Salario, ISR, cuotas y más',
    href: '/app/herramientas',
    icon: Calculator,
    iconBg: 'bg-[rgba(245,200,66,0.10)]',
    iconColor: 'text-[var(--warn-text)]',
  },
  {
    id: 'ajustes',
    label: 'Configuración',
    description: 'Perfil, plan, moneda y datos',
    href: '/app/ajustes',
    icon: Settings,
    iconBg: 'bg-[var(--overlay-1)]',
    iconColor: 'text-[var(--text2)]',
  },
]

export default async function MasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, plan')
    .eq('id', user.id)
    .single()

  const { data: isAdminRaw } = await supabase.rpc('is_admin')
  const isAdmin = !!isAdminRaw

  const firstName = (profile?.display_name as string | null)?.trim().split(/\s+/)[0]
  const plan = (profile?.plan as string | null) ?? 'trial'

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-eyebrow font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Más
        </div>
        <h1 className="text-[26px] sm:text-[32px] leading-[1.05] font-bold tracking-tight">
          Hola, <span className="gradient-text">{firstName ?? 'amigo'}</span>.
        </h1>
        <p className="text-body text-[var(--text2)] leading-relaxed">
          Las funciones que no caben en la barra inferior viven aquí.
        </p>
      </div>

      {/* Plan card */}
      <Link
        href="/app/upgrade"
        className="block rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 hover:border-[var(--brand-2)]/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-bg text-[#0B0B0C] flex items-center justify-center shrink-0">
            <ShieldCheck size={20} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-body font-semibold text-[var(--text)]">
              {plan === 'pro'
                ? 'MARELL Pro activo'
                : plan === 'trial'
                  ? 'Prueba Pro activa'
                  : 'Pasa a Pro'}
            </div>
            <div className="text-meta text-[var(--muted)] leading-relaxed">
              {plan === 'pro'
                ? 'Todas las funciones desbloqueadas'
                : plan === 'trial'
                  ? 'Disfruta todo gratis hasta el fin de tu prueba'
                  : 'Funciones premium por RD$999/mes'}
            </div>
          </div>
          <ChevronRight
            size={16}
            strokeWidth={2.2}
            className="text-[var(--muted)] shrink-0"
          />
        </div>
      </Link>

      {/* Quick grid */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 hover:border-[var(--border3)] hover:bg-[var(--overlay-1)] transition-colors h-full"
              >
                <div
                  className={`w-10 h-10 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center mb-3`}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div className="text-body font-semibold text-[var(--text)] leading-tight">
                  {item.label}
                </div>
                <div className="text-eyebrow text-[var(--muted)] mt-0.5 leading-snug">
                  {item.description}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Admin link */}
      {isAdmin && (
        <Link
          href="/admin"
          className="block rounded-2xl border border-[var(--warn)]/30 bg-[rgba(245,200,66,0.04)] p-4 hover:border-[var(--warn)]/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(245,200,66,0.10)] text-[var(--warn-text)] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-body font-semibold text-[var(--text)]">
                Panel admin
              </div>
              <div className="text-eyebrow text-[var(--muted)]">
                Solo visible para tu cuenta
              </div>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={2.2}
              className="text-[var(--muted)] shrink-0"
            />
          </div>
        </Link>
      )}

      {/* Help + logout footer */}
      <div className="space-y-2 pt-2">
        <Link
          href="mailto:hola@marell.app"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
        >
          <LifeBuoy size={18} strokeWidth={2} className="shrink-0" />
          <div className="flex-1 text-body">Ayuda y soporte</div>
          <ChevronRight size={16} strokeWidth={2.2} className="shrink-0" />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.06)] transition-colors text-left"
          >
            <LogOut size={18} strokeWidth={2} className="shrink-0" />
            <div className="flex-1 text-body">Cerrar sesión</div>
          </button>
        </form>
      </div>

      <div className="text-center text-eyebrow text-[var(--muted2)] pt-4 pb-2">
        MARELL · v1.0
      </div>
    </div>
  )
}
