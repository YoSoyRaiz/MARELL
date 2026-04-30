'use client'

import {
  CreditCard,
  Car,
  GraduationCap,
  Banknote,
  Stethoscope,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { Debt } from '../types'

const OPTIONS: { id: Debt; Icon: LucideIcon; title: string; description?: string }[] = [
  { id: 'credit_card', Icon: CreditCard, title: 'Tarjeta de crédito' },
  { id: 'auto', Icon: Car, title: 'Préstamo de auto' },
  { id: 'student', Icon: GraduationCap, title: 'Préstamo estudiantil' },
  { id: 'personal', Icon: Banknote, title: 'Préstamo personal' },
  { id: 'medical', Icon: Stethoscope, title: 'Deuda médica' },
  { id: 'bnpl', Icon: ShoppingBag, title: 'Compras a plazos (BNPL)' },
  { id: 'none', Icon: Sparkles, title: 'Ninguna', description: 'Estoy libre de deudas.' },
]

export function Step07Debts() {
  const selected = useOnboardingStore((s) => s.answers.debts)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Tienes <span className="gradient-text">deudas</span> activas?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Marca todas las que apliquen. Crearemos un plan para pagarlas.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('debts', toggleInArray(selected, opt.id, 'none'))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
