'use client'

import { useEffect } from 'react'
import { WizardShell } from './wizard/WizardShell'
import { STEPS } from './wizard/steps'
import { useOnboardingStore } from './wizard/store'

export function OnboardingWizardClient({ initialName }: { initialName: string | null }) {
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const currentName = useOnboardingStore((s) => s.answers.name)

  // Pre-fill name from signup display_name on first arrival
  useEffect(() => {
    if (initialName && initialName.trim().length > 0 && currentName.trim().length === 0) {
      setAnswer('name', initialName.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <WizardShell steps={STEPS} />
}
