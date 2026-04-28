'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetOnboarding } from '@/app/onboarding/actions'

export function ResetOnboardingButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (
      !window.confirm(
        '¿Rehacer el onboarding? Esto borra tu plan actual (categorías, cuentas, asignaciones) y te lleva de vuelta al wizard. Esta acción no se puede deshacer.',
      )
    )
      return
    setError(null)
    startTransition(async () => {
      const result = await resetOnboarding()
      if (result && 'error' in result && result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-[12px] font-medium px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 text-[var(--muted)] border-[var(--border2)] hover:text-[var(--text)] hover:border-[var(--border3)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
      >
        <RotateCcw size={12} strokeWidth={2.2} />
        {pending ? 'Borrando...' : 'Rehacer onboarding'}
      </button>
      {error && <span className="text-[11px] text-[var(--coral)]">{error}</span>}
    </div>
  )
}
