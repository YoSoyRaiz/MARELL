'use client'

import { Home, KeyRound, LifeBuoy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import type { Housing } from '../types'

const OPTIONS: { id: Housing; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'own', Icon: Home, title: 'Soy propietario', description: 'Tengo casa propia.' },
  { id: 'rent', Icon: KeyRound, title: 'Alquilo', description: 'Pago renta cada mes.' },
  { id: 'other', Icon: LifeBuoy, title: 'Otra situación', description: 'Vivo con familia, etc.' },
]

export function Step05Housing() {
  const selected = useOnboardingStore((s) => s.answers.housing)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          Cuéntanos sobre tu <span className="gradient-text">casa</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Vivienda suele ser el gasto más grande del mes — vamos a ajustarlo.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            active={selected === opt.id}
            onClick={() => setAnswer('housing', opt.id)}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
