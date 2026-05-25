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
  Check,
  Coins,
  ShoppingCart,
  Repeat,
  CalendarClock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { WizardHeading } from '../components/WizardHeading'
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

interface SectionMeta {
  k: SectionKey
  Icon: LucideIcon
  label: string
  shortLabel: string
  required: boolean
}

const SECTIONS: SectionMeta[] = [
  { k: 'debts', Icon: Coins, label: 'Deudas activas', shortLabel: 'Deudas', required: true },
  { k: 'transport', Icon: Bus, label: 'Cómo te transportas', shortLabel: 'Transporte', required: false },
  { k: 'regular', Icon: ShoppingCart, label: 'Gastos regulares', shortLabel: 'Regulares', required: false },
  { k: 'subscriptions', Icon: Repeat, label: 'Suscripciones', shortLabel: 'Subs', required: true },
  { k: 'infrequent', Icon: CalendarClock, label: 'Gastos menos frecuentes', shortLabel: 'Infrecuentes', required: true },
]

/**
 * Tabs horizontales — 5 secciones siempre visibles arriba como pills
 * con icono + nombre corto + badge de count (✓ N o "!" si requerida y
 * vacía). El user ve de un vistazo qué falta sin tener que scrollear
 * a abrir un acordeón. Reemplaza Step07Debts + Step08Transport +
 * Step09RegularSpending + Step10Subscriptions + Step12InfrequentExpenses.
 *
 * Layout pensado para `wide: true` (max-w-5xl en WizardShell): tabs
 * en una sola fila en desktop, scroll horizontal contenido en mobile.
 * El panel activo abajo tiene espacio cómodo para 3-col grids.
 */
export function Step07Lifestyle() {
  const answers = useOnboardingStore((s) => s.answers)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const [active, setActive] = useState<SectionKey>('debts')

  const counts: Record<SectionKey, number> = {
    debts: answers.debts.length,
    transport: answers.transport.length,
    regular: answers.regularSpending.length,
    subscriptions: answers.subscriptions.length,
    infrequent: answers.infrequentExpenses.length,
  }

  return (
    <div className="space-y-7">
      <WizardHeading
        descriptionMaxWidth="2xl"
        description="Cinco categorías de gastos. Marca todo lo que aplique en cada una — generaremos categorías acordes a tu vida."
      >
        Tu <span className="gradient-text">día a día</span>.
      </WizardHeading>

      {/* Tab bar — sticky-ish behavior gracias al sticky top:0
          dentro de la página del wizard. Scroll horizontal en mobile
          si los 5 chips no caben. */}
      <nav
        aria-label="Secciones"
        className="-mx-1 px-1 overflow-x-auto scrollbar-none"
      >
        <ul className="flex items-stretch gap-2 min-w-max">
          {SECTIONS.map((s) => {
            const isActive = active === s.k
            const count = counts[s.k]
            const done = count > 0
            const missing = s.required && !done
            return (
              <li key={s.k}>
                <button
                  type="button"
                  onClick={() => setActive(s.k)}
                  aria-pressed={isActive}
                  className={`group relative h-auto py-2.5 px-4 rounded-2xl border inline-flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'border-[var(--brand-2)] bg-[rgba(61,220,151,0.10)]'
                      : missing
                        ? 'border-[var(--coral)]/35 bg-[var(--s1)] hover:border-[var(--coral)]/60'
                        : 'border-[var(--border2)] bg-[var(--s1)] hover:border-[var(--border3)]'
                  }`}
                >
                  <span
                    className={`grid place-items-center w-6 h-6 rounded-lg shrink-0 ${
                      isActive
                        ? 'bg-[var(--brand-2)] text-[#0B0B0C]'
                        : done
                          ? 'bg-[rgba(61,220,151,0.14)] text-[var(--brand-text)]'
                          : 'bg-[var(--overlay-2)] text-[var(--text2)]'
                    }`}
                  >
                    <s.Icon size={13} strokeWidth={2.4} />
                  </span>
                  <span className="flex flex-col items-start min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--text)] leading-tight">
                      {s.shortLabel}
                    </span>
                    {done ? (
                      <span className="text-[10px] text-[var(--brand-text)] font-medium leading-tight mt-0.5 inline-flex items-center gap-1">
                        <Check size={9} strokeWidth={3} />
                        {count}
                      </span>
                    ) : missing ? (
                      <span className="text-[10px] text-[var(--coral-text)] font-medium leading-tight mt-0.5">
                        Requerido
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--muted)] leading-tight mt-0.5">
                        Opcional
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Panel del tab activo. key forza re-mount → animación de
          entrada en cada cambio, sutil. */}
      <div key={active} className="animate-step">
        {active === 'debts' && (
          <Panel
            title="Deudas activas"
            subtitle="¿Tienes préstamos o tarjetas que estés pagando?"
            cols={3}
          >
            {DEBT_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.debts.includes(opt.id)}
                onClick={() =>
                  setAnswer('debts', toggleInArray(answers.debts, opt.id, 'none'))
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </Panel>
        )}

        {active === 'transport' && (
          <Panel
            title="Cómo te transportas"
            subtitle="Opcional — para categorías de gasolina o transporte."
            cols={3}
          >
            {TRANSPORT_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={answers.transport.includes(opt.id)}
                onClick={() =>
                  setAnswer('transport', toggleInArray(answers.transport, opt.id))
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
              />
            ))}
          </Panel>
        )}

        {active === 'regular' && (
          <Panel
            title="Gastos regulares"
            subtitle="Opcional — supermercado, internet, etc."
            cols={2}
          >
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
          </Panel>
        )}

        {active === 'subscriptions' && (
          <Panel
            title="Suscripciones"
            subtitle="Estos son los que más se olvidan."
            cols={2}
          >
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
          </Panel>
        )}

        {active === 'infrequent' && (
          <Panel
            title="Gastos menos frecuentes"
            subtitle="Anuales o estacionales — para no tomarte por sorpresa."
            cols={2}
          >
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
          </Panel>
        )}
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  cols,
  children,
}: {
  title: string
  subtitle: string
  cols: 2 | 3
  children: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{title}</h2>
        <p className="text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>
      </div>
      <div
        className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${
          cols === 3 ? 'lg:grid-cols-3' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}
