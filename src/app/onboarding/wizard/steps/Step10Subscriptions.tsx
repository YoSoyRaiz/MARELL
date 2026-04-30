'use client'

import { Music, Tv, Dumbbell, Briefcase, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { Subscription } from '../types'

const OPTIONS: { id: Subscription; Icon: LucideIcon; title: string; description?: string }[] = [
  { id: 'music', Icon: Music, title: 'Música', description: 'Spotify, Apple Music, etc.' },
  { id: 'streaming', Icon: Tv, title: 'Streaming TV', description: 'Netflix, Disney+, HBO, etc.' },
  { id: 'fitness', Icon: Dumbbell, title: 'Fitness', description: 'Gimnasio o app de ejercicio.' },
  { id: 'other', Icon: Briefcase, title: 'Otras', description: 'Apps, software, news, etc.' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna', description: 'No tengo suscripciones.' },
]

export function Step10Subscriptions() {
  const selected = useOnboardingStore((s) => s.answers.subscriptions)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Qué <span className="gradient-text">suscripciones</span> tienes?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Estos son gastos que muchas veces se olvidan. Vamos a tenerlos visibles.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('subscriptions', toggleInArray(selected, opt.id, 'none'))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
