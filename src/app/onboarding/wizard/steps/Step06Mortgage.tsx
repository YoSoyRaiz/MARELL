'use client'

import { Banknote, Ban, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import type { Mortgage } from '../types'

const OPTIONS: { id: Mortgage; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'yes', Icon: Banknote, title: 'Sí', description: 'La estoy pagando ahora.' },
  { id: 'no', Icon: Ban, title: 'No', description: 'No tengo hipoteca.' },
  { id: 'paid_off', Icon: CheckCircle, title: 'Está pagada', description: 'Ya la terminé.' },
]

export function Step06Mortgage() {
  const selected = useOnboardingStore((s) => s.answers.mortgage)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Tienes <span className="gradient-text">hipoteca</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Si la pagas mes a mes, la sumamos a tu plan automáticamente.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            active={selected === opt.id}
            onClick={() => setAnswer('mortgage', opt.id)}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
