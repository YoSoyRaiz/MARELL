'use client'

import { Sparkles } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step03Transition() {
  const name = useOnboardingStore((s) => s.answers.name)
  const firstName = name.trim().split(' ')[0]

  return (
    <TransitionSlide
      icon={<Sparkles strokeWidth={2.2} />}
      title={
        <>
          {firstName ? `Vamos a construir tu plan, ${firstName}.` : 'Vamos a construir tu plan.'}
        </>
      }
      subtitle={
        <>
          Te haremos unas preguntas rápidas sobre tu situación. Al final tendrás un set de{' '}
          <span className="text-[var(--text)] font-medium">categorías personalizadas</span> a tu vida.
        </>
      }
    />
  )
}
