'use client'

import { Sparkles, CreditCard, Target, Waves, Sprout, Compass } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { WizardHeading } from '../components/WizardHeading'
import type { Motivation } from '../types'

const OPTIONS: { id: Motivation; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'simplify', Icon: Sparkles, title: 'Simplificar mis finanzas', description: 'Tener todo en un solo lugar y sin estrés.' },
  { id: 'pay_off_debt', Icon: CreditCard, title: 'Salir de deudas', description: 'Liberarme de tarjetas y préstamos.' },
  { id: 'save_for_goal', Icon: Target, title: 'Ahorrar para una meta', description: 'Vacaciones, casa, carro o lo que sea.' },
  { id: 'stop_paycheck_to_paycheck', Icon: Waves, title: 'Dejar de vivir mes a mes', description: 'Llegar a fin de mes con calma.' },
  { id: 'build_habits', Icon: Sprout, title: 'Construir buenos hábitos', description: 'Aprender a manejar mi dinero.' },
  { id: 'take_control', Icon: Compass, title: 'Tomar el control', description: 'Saber a dónde se va cada peso.' },
]

export function Step02Motivation() {
  const selected = useOnboardingStore((s) => s.answers.motivation)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const name = useOnboardingStore((s) => s.answers.name)

  const firstName = name.trim().split(' ')[0]
  const greeting = firstName ? `${firstName}, ¿qué te trae a ` : '¿Qué te trae a '

  return (
    <div className="space-y-8">
      <WizardHeading description="Vamos a personalizar tu plan según lo que más te importa.">
        {greeting}
        <span className="gradient-text">MARELL</span>?
      </WizardHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <SelectCard
            key={opt.id}
            active={selected === opt.id}
            onClick={() => setAnswer('motivation', opt.id)}
            icon={<opt.Icon size={20} strokeWidth={2} />}
            title={opt.title}
            description={opt.description}
          />
        ))}
      </div>
    </div>
  )
}
