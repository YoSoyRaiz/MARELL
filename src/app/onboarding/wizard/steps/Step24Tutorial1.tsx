'use client'

import { Smile } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step24Tutorial1() {
  return (
    <TransitionSlide
      icon={<Smile strokeWidth={2.2} />}
      title={
        <>
          Buen trabajo. Tu plan <span className="gradient-text">está listo</span>.
        </>
      }
      subtitle={
        <>Respira hondo. Lo difícil ya pasó — lo que sigue es ir afinándolo a medida que vivas.</>
      }
    />
  )
}
