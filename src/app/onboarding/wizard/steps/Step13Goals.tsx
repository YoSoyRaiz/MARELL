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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { Goal } from '../types'

const OPTIONS: { id: Goal; Icon: LucideIcon; title: string }[] = [
  { id: 'emergency_fund', Icon: LifeBuoy, title: 'Fondo de emergencia' },
  { id: 'vacation', Icon: Plane, title: 'Vacaciones de ensueño' },
  { id: 'new_car', Icon: Car, title: 'Carro nuevo' },
  { id: 'new_home', Icon: HousePlus, title: 'Casa nueva' },
  { id: 'wedding', Icon: Diamond, title: 'Boda' },
  { id: 'baby', Icon: Baby, title: 'Bebé' },
  { id: 'retirement', Icon: Sun, title: 'Retiro' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna por ahora' },
]

export function Step13Goals() {
  const selected = useOnboardingStore((s) => s.answers.goals)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Qué <span className="gradient-text">metas</span> priorizar?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Las metas grandes se logran apartando poco a poco cada mes.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('goals', toggleInArray(selected, opt.id, 'none'))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
          />
        ))}
      </div>
    </div>
  )
}
