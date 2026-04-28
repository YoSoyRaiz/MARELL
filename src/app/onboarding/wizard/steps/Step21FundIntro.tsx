'use client'

import { Coins } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step21FundIntro() {
  return (
    <TransitionSlide
      icon={<Coins strokeWidth={2.2} />}
      title={
        <>
          Dale <span className="gradient-text">trabajo</span> a cada peso.
        </>
      }
      subtitle={
        <>
          Este es el dinero que tienes en tus cuentas. Vamos a asignarlo a tus categorías hasta que
          cada peso tenga su misión.{' '}
          <span className="text-[var(--text)] font-medium">
            Esa es la diferencia entre tener dinero y tener un plan.
          </span>
        </>
      }
    />
  )
}
