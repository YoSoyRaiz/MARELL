'use client'

import { User, Heart, Users, HousePlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import type { Household } from '../types'

const OPTIONS: { id: Household; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'myself', Icon: User, title: 'Solo yo', description: 'Manejo mis propias finanzas.' },
  { id: 'partner', Icon: Heart, title: 'Con mi pareja', description: 'Compartimos decisiones de dinero.' },
  { id: 'family', Icon: Users, title: 'Con mi familia', description: 'Tengo personas a mi cargo.' },
  { id: 'roommates', Icon: HousePlus, title: 'Con roommates', description: 'Convivo pero finanzas separadas.' },
]

export function Step04Household() {
  const selected = useOnboardingStore((s) => s.answers.household)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Quién está en tu <span className="gradient-text">hogar</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Esto nos ayuda a entender mejor tus gastos y metas.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            active={selected === opt.id}
            onClick={() => setAnswer('household', opt.id)}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
