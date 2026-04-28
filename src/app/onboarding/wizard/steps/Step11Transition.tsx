'use client'

import { Calendar } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step11Transition() {
  return (
    <TransitionSlide
      icon={<Calendar strokeWidth={2.2} />}
      title={
        <>
          Ahora pensemos <span className="gradient-text">más allá</span> del mes.
        </>
      }
      subtitle={
        <>
          Las facturas mensuales son solo parte del juego. Lo que separa un buen plan de uno{' '}
          <span className="text-[var(--text)] font-medium">excelente</span> es prepararse para gastos
          ocasionales y metas a futuro.
        </>
      }
    />
  )
}
