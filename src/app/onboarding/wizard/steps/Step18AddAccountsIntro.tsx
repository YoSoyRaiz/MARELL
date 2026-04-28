'use client'

import { Wallet } from 'lucide-react'
import { TransitionSlide } from '../components/TransitionSlide'

export function Step18AddAccountsIntro() {
  return (
    <TransitionSlide
      icon={<Wallet strokeWidth={2.2} />}
      title={
        <>
          Agreguemos tus <span className="gradient-text">cuentas</span>.
        </>
      }
      subtitle={
        <>
          Conecta tu banco y tarjetas para halar balances y movimientos automáticamente, o
          ingrésalos a mano. Pronto vas a tener una visión completa de tu dinero.
        </>
      }
    />
  )
}
