'use client'

import { WizardShell } from '../wizard/WizardShell'
import { STEPS } from '../wizard/steps'

export default function OnboardingPreviewPage() {
  return <WizardShell steps={STEPS} />
}
