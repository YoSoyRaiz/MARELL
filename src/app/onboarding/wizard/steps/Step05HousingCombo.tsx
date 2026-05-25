'use client'

import { Home, KeyRound, LifeBuoy, Banknote, Ban, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { SelectCard } from '../components/SelectCard'
import { WizardHeading } from '../components/WizardHeading'
import type { Housing, Mortgage } from '../types'

const HOUSING_OPTIONS: { id: Housing; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'own', Icon: Home, title: 'Soy propietario', description: 'Tengo casa propia.' },
  { id: 'rent', Icon: KeyRound, title: 'Alquilo', description: 'Pago renta cada mes.' },
  { id: 'other', Icon: LifeBuoy, title: 'Otra situación', description: 'Vivo con familia, etc.' },
]

const MORTGAGE_OPTIONS: { id: Mortgage; Icon: LucideIcon; title: string; description: string }[] = [
  { id: 'yes', Icon: Banknote, title: 'Sí', description: 'La estoy pagando ahora.' },
  { id: 'no', Icon: Ban, title: 'No', description: 'No tengo hipoteca.' },
  { id: 'paid_off', Icon: CheckCircle, title: 'Está pagada', description: 'Ya la terminé.' },
]

/**
 * Combina las antiguas Step05Housing + Step06Mortgage en una sola
 * página. El bloque de hipoteca solo aparece cuando el user elige
 * "Soy propietario" — para alquiler / otra situación es irrelevante.
 * Resultado: una decisión cohesiva sobre la vivienda en lugar de dos
 * pasos secuenciales con un click "Siguiente" innecesario.
 */
export function Step05HousingCombo() {
  const housing = useOnboardingStore((s) => s.answers.housing)
  const mortgage = useOnboardingStore((s) => s.answers.mortgage)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-8">
      <WizardHeading description="Vivienda suele ser el gasto más grande del mes — vamos a ajustarlo.">
        Cuéntanos sobre tu <span className="gradient-text">casa</span>.
      </WizardHeading>

      {/* Block 1 — tipo de vivienda */}
      <div className="space-y-3">
        <div className="text-meta uppercase tracking-[0.18em] text-[var(--muted)] font-semibold">
          ¿Dónde vives?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {HOUSING_OPTIONS.map((opt) => (
            <SelectCard
              key={opt.id}
              active={housing === opt.id}
              onClick={() => {
                setAnswer('housing', opt.id)
                // Si cambia a no-propietario, limpia mortgage para que
                // no quede un valor zombie que afecte la generación.
                if (opt.id !== 'own') setAnswer('mortgage', 'no')
              }}
              icon={<opt.Icon size={20} strokeWidth={2} />}
              title={opt.title}
              description={opt.description}
            />
          ))}
        </div>
      </div>

      {/* Block 2 — hipoteca (solo si es propietario) */}
      {housing === 'own' && (
        <div className="space-y-3 animate-step">
          <div className="text-meta uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
            ¿Tienes hipoteca?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MORTGAGE_OPTIONS.map((opt) => (
              <SelectCard
                key={opt.id}
                active={mortgage === opt.id}
                onClick={() => setAnswer('mortgage', opt.id)}
                icon={<opt.Icon size={20} strokeWidth={2} />}
                title={opt.title}
                description={opt.description}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
