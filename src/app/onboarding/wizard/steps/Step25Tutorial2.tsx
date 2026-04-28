'use client'

import { Compass } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step25Tutorial2() {
  return (
    <TransitionSlide
      icon={<Compass strokeWidth={2.2} />}
      title={
        <>
          Lo que <span className="gradient-text">sigue</span>.
        </>
      }
      subtitle={
        <>
          Usa tu plan para guiar tus gastos. Cuando algo cambie —{' '}
          <span className="text-[var(--text)] font-medium">y va a cambiar</span> — mueves dinero
          entre categorías. Eso es todo.
        </>
      }
    />
  )
}
