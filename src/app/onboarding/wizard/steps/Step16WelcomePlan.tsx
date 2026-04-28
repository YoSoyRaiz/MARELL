'use client'

import { Sparkles } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step16WelcomePlan() {
  const name = useOnboardingStore((s) => s.answers.name)
  const firstName = name.trim().split(' ')[0]

  return (
    <TransitionSlide
      icon={<Sparkles strokeWidth={2.2} />}
      title={
        <>
          {firstName ? `¡Listo, ${firstName}! ` : '¡Listo! '}
          Vamos a <span className="gradient-text">personalizar</span> tu plan.
        </>
      }
      subtitle={
        <>
          Tres pasos rápidos: ponemos metas a cada categoría, agregamos tus cuentas, y le damos
          <span className="text-[var(--text)] font-medium"> trabajo</span> a cada peso.
        </>
      }
    />
  )
}
