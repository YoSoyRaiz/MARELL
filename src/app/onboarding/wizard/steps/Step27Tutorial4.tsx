'use client'

import { HandCoins } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step27Tutorial4() {
  return (
    <TransitionSlide
      icon={<HandCoins strokeWidth={2.2} />}
      title={
        <>
          Cada peso, <span className="gradient-text">su trabajo</span>.
        </>
      }
      subtitle={
        <>
          Cuando entre dinero, dale un trabajo a cada peso antes de gastarlo. Esa es la práctica
          que separa a quienes manejan su dinero de quienes lo dejan ir.
        </>
      }
    />
  )
}
