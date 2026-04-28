'use client'

import { CreditCard, Stethoscope, Receipt, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { toggleInArray } from '../multiSelect'
import type { InfrequentExpense } from '../types'

const OPTIONS: { id: InfrequentExpense; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'credit_card_annual', Icon: CreditCard, title: 'Cuotas anuales', description: 'Tarjetas de crédito o membresías.' },
  { id: 'medical', Icon: Stethoscope, title: 'Gastos médicos', description: 'Citas, exámenes, emergencias.' },
  { id: 'taxes', Icon: Receipt, title: 'Impuestos', description: 'DGII, ITBIS u otros.' },
  { id: 'none', Icon: Sparkles, title: 'Ninguno', description: 'Por ahora no preveo gastos así.' },
]

export function Step12InfrequentExpenses() {
  const selected = useOnboardingStore((s) => s.answers.infrequentExpenses)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          ¿Qué gastos <span className="gradient-text">menos frecuentes</span> preparar?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Esto evita que te tomen por sorpresa. Apartamos un poco cada mes.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            multi
            active={selected.includes(opt.id)}
            onClick={() => setAnswer('infrequentExpenses', toggleInArray(selected, opt.id, 'none'))}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
