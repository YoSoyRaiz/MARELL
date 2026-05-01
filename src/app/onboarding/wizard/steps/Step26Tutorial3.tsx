'use client'

import { Repeat } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step26Tutorial3() {
  return (
    <TransitionSlide
      icon={<Repeat strokeWidth={2.2} />}
      title={
        <>
          La vida cambia. Tu plan <span className="gradient-text">también</span>.
        </>
      }
      subtitle={
        <>
          No solo está permitido — lo recomendamos. Mover dinero entre categorías no es un error:
          es exactamente cómo se usa MARELL.
        </>
      }
    />
  )
}
