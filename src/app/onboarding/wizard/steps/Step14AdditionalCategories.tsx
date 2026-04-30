'use client'

import { Utensils, Film, Palette, HandHeart, Gift, Sofa } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { AdditionalCategory } from '../types'

const OPTIONS: { id: AdditionalCategory; Icon: LucideIcon; title: string; description?: string }[] = [
  { id: 'dining_out', Icon: Utensils, title: 'Restaurantes', description: 'Comer fuera de casa.' },
  { id: 'entertainment', Icon: Film, title: 'Entretenimiento', description: 'Cine, conciertos, salidas.' },
  { id: 'hobbies', Icon: Palette, title: 'Hobbies', description: 'Lo que te apasiona.' },
  { id: 'charity', Icon: HandHeart, title: 'Caridad', description: 'Donar o ayudar a otros.' },
  { id: 'gifts', Icon: Gift, title: 'Regalos', description: 'Cumpleaños, navidad, etc.' },
  { id: 'home_decor', Icon: Sofa, title: 'Decoración', description: 'Hacer tu hogar más tuyo.' },
]

export function Step14AdditionalCategories() {
  const selected = useOnboardingStore((s) => s.answers.additionalCategories)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Qué más incluir en tu plan?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          <span className="gradient-text font-medium">Sin pena, sin culpa.</span> Estos también son
          parte de la vida que vale la pena vivir.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('additionalCategories', toggleInArray(selected, opt.id))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
