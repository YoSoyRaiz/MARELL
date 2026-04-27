import type { StepDef } from './types'
import { Step01Name } from './steps/Step01Name'
import { Step02Motivation } from './steps/Step02Motivation'

export const STEPS: StepDef[] = [
  {
    id: 'name',
    phase: 'Sobre ti',
    primaryLabel: 'Empezar',
    canContinue: (a) => a.name.trim().length >= 2,
    Component: Step01Name,
  },
  {
    id: 'motivation',
    phase: 'Sobre ti',
    canContinue: (a) => a.motivation !== null,
    Component: Step02Motivation,
  },
]
