'use client'

import { Car, Bus, Waypoints, Zap, Bike, Footprints, Accessibility } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { Transport } from '../types'

const OPTIONS: { id: Transport; Icon: LucideIcon; title: string }[] = [
  { id: 'car', Icon: Car, title: 'Carro propio' },
  { id: 'public', Icon: Bus, title: 'Transporte público' },
  { id: 'rideshare', Icon: Waypoints, title: 'Uber / taxi' },
  { id: 'motorcycle', Icon: Zap, title: 'Motor' },
  { id: 'bike', Icon: Bike, title: 'Bicicleta' },
  { id: 'walk', Icon: Footprints, title: 'Camino' },
  { id: 'wheelchair', Icon: Accessibility, title: 'Silla de ruedas' },
]

export function Step08Transport() {
  const selected = useOnboardingStore((s) => s.answers.transport)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Cómo te <span className="gradient-text">transportas</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Marca todo lo que usas. Generaremos categorías para gasolina, mantenimiento y más.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('transport', toggleInArray(selected, opt.id))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
          />
        ))}
      </div>
    </div>
  )
}
