'use client'

import { useState, type ReactNode } from 'react'
import {
  CreditCard,
  Car,
  GraduationCap,
  Banknote,
  Stethoscope,
  ShoppingBag,
  Sparkles,
  Bus,
  Waypoints,
  Zap,
  Bike,
  Footprints,
  Wifi,
  Scissors,
  Shirt,
  Package,
  Music,
  Tv,
  Dumbbell,
  Briefcase,
  Receipt,
  ChevronDown,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type {
  Debt,
  Transport,
  RegularSpending,
  Subscription,
  InfrequentExpense,
} from '../types'

interface Option<T extends string> {
  id: T
  Icon: LucideIcon
  title: string
  description?: string
}

const DEBT_OPTIONS: Option<Debt>[] = [
  { id: 'credit_card', Icon: CreditCard, title: 'Tarjeta de crédito' },
  { id: 'auto', Icon: Car, title: 'Préstamo de auto' },
  { id: 'student', Icon: GraduationCap, title: 'Préstamo estudiantil' },
  { id: 'personal', Icon: Banknote, title: 'Préstamo personal' },
  { id: 'medical', Icon: Stethoscope, title: 'Deuda médica' },
  { id: 'bnpl', Icon: ShoppingBag, title: 'Compras a plazos (BNPL)' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna', description: 'Estoy libre de deudas.' },
]

const TRANSPORT_OPTIONS: Option<Transport>[] = [
  { id: 'car', Icon: Car, title: 'Carro propio' },
  { id: 'public', Icon: Bus, title: 'Transporte público' },
  { id: 'rideshare', Icon: Waypoints, title: 'Uber / taxi' },
  { id: 'motorcycle', Icon: Zap, title: 'Motor' },
  { id: 'bike', Icon: Bike, title: 'Bicicleta' },
  { id: 'walk', Icon: Footprints, title: 'Camino' },
]

const REGULAR_OPTIONS: Option<RegularSpending>[] = [
  { id: 'groceries', Icon: ShoppingBag, title: 'Supermercado', description: 'Comida y artículos del hogar.' },
  { id: 'tv_internet', Icon: Wifi, title: 'TV, teléfono e internet', description: 'Servicios mensuales.' },
  { id: 'personal_care', Icon: Scissors, title: 'Cuidado personal', description: 'Barbería, salón, productos.' },
  { id: 'clothing', Icon: Shirt, title: 'Ropa', description: 'Vestuario y calzado.' },
  { id: 'storage', Icon: Package, title: 'Self storage', description: 'Espacio extra para cosas.' },
]

const SUBSCRIPTION_OPTIONS: Option<Subscription>[] = [
  { id: 'music', Icon: Music, title: 'Música', description: 'Spotify, Apple Music, etc.' },
  { id: 'streaming', Icon: Tv, title: 'Streaming TV', description: 'Netflix, Disney+, HBO, etc.' },
  { id: 'fitness', Icon: Dumbbell, title: 'Fitness', description: 'Gimnasio o app de ejercicio.' },
  { id: 'other', Icon: Briefcase, title: 'Otras', description: 'Apps, software, news, etc.' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna', description: 'No tengo suscripciones.' },
]

const INFREQUENT_OPTIONS: Option<InfrequentExpense>[] = [
  { id: 'credit_card_annual', Icon: CreditCard, title: 'Cuotas anuales', description: 'Tarjetas de crédito o membresías.' },
  { id: 'medical', Icon: Stethoscope, title: 'Gastos médicos', description: 'Citas, exámenes, emergencias.' },
  { id: 'taxes', Icon: Receipt, title: 'Impuestos', description: 'DGII, ITBIS u otros.' },
  { id: 'none', Icon: Sparkles, title: 'Ninguno', description: 'Por ahora no preveo gastos así.' },
]

type SectionKey = 'debts' | 'transport' | 'regular' | 'subscriptions' | 'infrequent'

/**
 * Acordeón "Tu día a día" — colapsa 5 ex-pasos en uno. Cada sección
 * abre su grid de SelectCard cuando el user la toca; el badge muestra
 * "N seleccionado" o "Requerido" según estado. La primera sección
 * (Debts) arranca abierta para mostrar el patrón.
 *
 * Reemplaza Step07Debts + Step08Transport + Step09RegularSpending +
 * Step10Subscriptions + Step12InfrequentExpenses. Mismo data set, una
 * sola pantalla. Mobile-friendly: secciones se apilan verticales y
 * el grid interno usa el responsive estándar de cada multi-select.
 */
export function Step07Lifestyle() {
  const answers = useOnboardingStore((s) => s.answers)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const [open, setOpen] = useState<SectionKey | null>('debts')

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          Tu <span className="gradient-text">día a día</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          Marca todo lo que aplique en cada sección. Toca cualquier título
          para expandirla. Generaremos categorías acordes a tu vida.
        </p>
      </div>

      <div className="space-y-3">
        <Section
          k="debts"
          title="Deudas activas"
          subtitle="¿Tienes préstamos o tarjetas que estés pagando?"
          count={answers.debts.length}
          required
          open={open === 'debts'}
          onToggle={() => setOpen(open === 'debts' ? null : 'debts')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {DEBT_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.debts.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'debts',
                    toggleInArray(answers.debts, opt.id, 'none'),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </Section>

        <Section
          k="transport"
          title="Cómo te transportas"
          subtitle="Opcional — para categorías de gasolina o transporte."
          count={answers.transport.length}
          open={open === 'transport'}
          onToggle={() =>
            setOpen(open === 'transport' ? null : 'transport')
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {TRANSPORT_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.transport.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'transport',
                    toggleInArray(answers.transport, opt.id),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
              />
            ))}
          </div>
        </Section>

        <Section
          k="regular"
          title="Gastos regulares"
          subtitle="Opcional — supermercado, internet, etc."
          count={answers.regularSpending.length}
          open={open === 'regular'}
          onToggle={() => setOpen(open === 'regular' ? null : 'regular')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {REGULAR_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.regularSpending.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'regularSpending',
                    toggleInArray(answers.regularSpending, opt.id),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </Section>

        <Section
          k="subscriptions"
          title="Suscripciones"
          subtitle="Estos son los que más se olvidan."
          count={answers.subscriptions.length}
          required
          open={open === 'subscriptions'}
          onToggle={() =>
            setOpen(open === 'subscriptions' ? null : 'subscriptions')
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {SUBSCRIPTION_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.subscriptions.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'subscriptions',
                    toggleInArray(answers.subscriptions, opt.id, 'none'),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </Section>

        <Section
          k="infrequent"
          title="Gastos menos frecuentes"
          subtitle="Anuales o estacionales — para no tomarte por sorpresa."
          count={answers.infrequentExpenses.length}
          required
          open={open === 'infrequent'}
          onToggle={() =>
            setOpen(open === 'infrequent' ? null : 'infrequent')
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {INFREQUENT_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.infrequentExpenses.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'infrequentExpenses',
                    toggleInArray(answers.infrequentExpenses, opt.id, 'none'),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

interface SectionProps {
  k: SectionKey
  title: string
  subtitle: string
  count: number
  required?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}

function Section({
  title,
  subtitle,
  count,
  required,
  open,
  onToggle,
  children,
}: SectionProps) {
  const done = count > 0
  return (
    <div
      className={`rounded-2xl border bg-[var(--s1)] transition-colors ${
        open
          ? 'border-[var(--brand-2)]/50'
          : done
            ? 'border-[var(--border2)]'
            : 'border-[var(--border)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-5 py-4 flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[var(--text)]">
              {title}
            </span>
            {done ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-text)] bg-[rgba(61,220,151,0.12)] px-2 py-0.5 rounded-md">
                <Check size={10} strokeWidth={3} />
                {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
            ) : required ? (
              <span className="text-[11px] font-semibold text-[var(--coral-text)] bg-[rgba(255,122,89,0.10)] px-2 py-0.5 rounded-md">
                Requerido
              </span>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">
                Opcional
              </span>
            )}
          </div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug">
            {subtitle}
          </div>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2.2}
          className={`text-[var(--text2)] shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[var(--border)] pt-3 animate-step">
          {children}
        </div>
      )}
    </div>
  )
}
