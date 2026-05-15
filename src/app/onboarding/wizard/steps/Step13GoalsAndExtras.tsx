'use client'

import {
  LifeBuoy,
  Plane,
  Car,
  HousePlus,
  Diamond,
  Baby,
  Sun,
  Sparkles,
  Utensils,
  Film,
  Palette,
  HandHeart,
  Gift,
  Sofa,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { Goal, AdditionalCategory } from '../types'

const GOAL_OPTIONS: { id: Goal; Icon: LucideIcon; title: string }[] = [
  { id: 'emergency_fund', Icon: LifeBuoy, title: 'Fondo de emergencia' },
  { id: 'vacation', Icon: Plane, title: 'Vacaciones de ensueño' },
  { id: 'new_car', Icon: Car, title: 'Carro nuevo' },
  { id: 'new_home', Icon: HousePlus, title: 'Casa nueva' },
  { id: 'wedding', Icon: Diamond, title: 'Boda' },
  { id: 'baby', Icon: Baby, title: 'Bebé' },
  { id: 'retirement', Icon: Sun, title: 'Retiro' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna por ahora' },
]

const EXTRA_OPTIONS: { id: AdditionalCategory; Icon: LucideIcon; title: string; description?: string }[] = [
  { id: 'dining_out', Icon: Utensils, title: 'Restaurantes', description: 'Comer fuera de casa.' },
  { id: 'entertainment', Icon: Film, title: 'Entretenimiento', description: 'Cine, conciertos, salidas.' },
  { id: 'hobbies', Icon: Palette, title: 'Hobbies', description: 'Lo que te apasiona.' },
  { id: 'charity', Icon: HandHeart, title: 'Caridad', description: 'Donar o ayudar a otros.' },
  { id: 'gifts', Icon: Gift, title: 'Regalos', description: 'Cumpleaños, navidad, etc.' },
  { id: 'home_decor', Icon: Sofa, title: 'Decoración', description: 'Hacer tu hogar más tuyo.' },
]

/**
 * Combina Goals + AdditionalCategories en dos columnas (desktop) o
 * dos secciones apiladas (mobile). Ambas son lookups del "futuro" del
 * user — qué quiere lograr + qué placeres quiere incluir en el plan.
 * Antes eran dos pasos secuenciales con copy redundante; ahora un
 * solo glance.
 */
export function Step13GoalsAndExtras() {
  const goals = useOnboardingStore((s) => s.answers.goals)
  const extras = useOnboardingStore((s) => s.answers.additionalCategories)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          Tu <span className="gradient-text">futuro</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          ¿Qué quieres lograr y qué placeres incluir? Marca todo lo que
          aplique — sin pena, sin culpa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals (required) */}
        <div className="space-y-3">
          <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
            Metas a priorizar
          </div>
          <p className="text-[13px] text-[var(--muted)] leading-snug">
            Las grandes se logran apartando poco a poco cada mes.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {GOAL_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={goals.includes(opt.id)}
                onClick={() =>
                  setAnswer('goals', toggleInArray(goals, opt.id, 'none'))
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
              />
            ))}
          </div>
        </div>

        {/* Additional categories (optional) */}
        <div className="space-y-3">
          <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--muted)] font-semibold">
            Qué disfrutar · opcional
          </div>
          <p className="text-[13px] text-[var(--muted)] leading-snug">
            La vida que vale la pena vivir también necesita su categoría.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {EXTRA_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                multi
                active={extras.includes(opt.id)}
                onClick={() =>
                  setAnswer(
                    'additionalCategories',
                    toggleInArray(extras, opt.id),
                  )
                }
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
