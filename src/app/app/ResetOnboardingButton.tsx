'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetOnboarding } from '@/app/onboarding/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function ResetOnboardingButton() {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    const ok = await confirm({
      title: '¿Rehacer el onboarding?',
      description:
        'Esto borra tu plan actual (categorías, cuentas, asignaciones) y te lleva de vuelta al wizard. No se puede deshacer.',
      confirmLabel: 'Borrar y rehacer',
      tone: 'danger',
    })
    if (!ok) return
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
