'use client'

import { useEffect } from 'react'
import { WizardShell } from './wizard/WizardShell'
import { STEPS } from './wizard/steps'
import { useOnboardingStore } from './wizard/store'

export function OnboardingWizardClient({
  initialName,
  userId,
}: {
  initialName: string | null
  userId: string
}) {
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const currentName = useOnboardingStore((s) => s.answers.name)

  // Stale-state guard. Triggered when:
  //   1. A previous user finished onboarding on this browser (their
  //      currentStep is at the last step) and a new user logs in.
  //   2. The persisted ownerId points at a different user.
  //   3. Same user hit "Rehacer" — server already wiped DB, here we
  //      mirror that on the client.
  useEffect(() => {
    const state = useOnboardingStore.getState()
    const isStale =
      state.currentStep >= STEPS.length - 1 ||
      (state.ownerId !== null && state.ownerId !== userId)
    if (isStale) {
      state.reset()
    }
    // Tag the now-fresh store with this session's owner so we can
    // detect mismatches in the future.
    useOnboardingStore.getState().setOwner(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Pre-fill name from signup display_name on first arrival
  useEffect(() => {
    if (initialName && initialName.trim().length > 0 && currentName.trim().length === 0) {
      setAnswer('name', initialName.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <WizardShell steps={STEPS} />
}
