'use client'

import { ShoppingBag, Wifi, Scissors, Shirt, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { RegularSpending } from '../types'

const OPTIONS: { id: RegularSpending; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'groceries', Icon: ShoppingBag, title: 'Supermercado', description: 'Comida y artículos del hogar.' },
  { id: 'tv_internet', Icon: Wifi, title: 'TV, teléfono e internet', description: 'Servicios mensuales.' },
  { id: 'personal_care', Icon: Scissors, title: 'Cuidado personal', description: 'Barbería, salón, productos.' },
  { id: 'clothing', Icon: Shirt, title: 'Ropa', description: 'Vestuario y calzado.' },
  { id: 'storage', Icon: Package, title: 'Self storage', description: 'Espacio extra para cosas.' },
]

export function Step09RegularSpending() {
  const selected = useOnboardingStore((s) => s.answers.regularSpending)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿En qué gastas <span className="gradient-text">regularmente</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Marca lo que aplique. Si nada aplica, simplemente continúa.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('regularSpending', toggleInArray(selected, opt.id))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
