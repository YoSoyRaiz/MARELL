import type { StepDef } from './types'
import { Step01Name } from './steps/Step01Name'
import { Step02Motivation } from './steps/Step02Motivation'
import { Step03Transition } from './steps/Step03Transition'
import { Step04Household } from './steps/Step04Household'
import { Step05Housing } from './steps/Step05Housing'
import { Step06Mortgage } from './steps/Step06Mortgage'
import { Step07Debts } from './steps/Step07Debts'
import { Step08Transport } from './steps/Step08Transport'
import { Step09RegularSpending } from './steps/Step09RegularSpending'
import { Step10Subscriptions } from './steps/Step10Subscriptions'
import { Step11Transition } from './steps/Step11Transition'
import { Step12InfrequentExpenses } from './steps/Step12InfrequentExpenses'
import { Step13Goals } from './steps/Step13Goals'
import { Step14AdditionalCategories } from './steps/Step14AdditionalCategories'
import { Step15CategoryList } from './steps/Step15CategoryList'

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
  {
    id: 'transition-plan',
    phase: 'Sobre ti',
    Component: Step03Transition,
  },
  {
    id: 'household',
    phase: 'Tu hogar',
    canContinue: (a) => a.household !== null,
    Component: Step04Household,
  },
  {
    id: 'housing',
    phase: 'Tu hogar',
    canContinue: (a) => a.housing !== null,
    Component: Step05Housing,
  },
  {
    id: 'mortgage',
    phase: 'Tu hogar',
    canContinue: (a) => a.mortgage !== null,
    Component: Step06Mortgage,
  },
  {
    id: 'debts',
    phase: 'Tu hogar',
    canContinue: (a) => a.debts.length > 0,
    Component: Step07Debts,
  },
  {
    id: 'transport',
    phase: 'Tu día a día',
    showSkip: true,
    Component: Step08Transport,
  },
  {
    id: 'regular-spending',
    phase: 'Tu día a día',
    showSkip: true,
    Component: Step09RegularSpending,
  },
  {
    id: 'subscriptions',
    phase: 'Tu día a día',
    canContinue: (a) => a.subscriptions.length > 0,
    Component: Step10Subscriptions,
  },
  {
    id: 'transition-future',
    phase: 'Tu futuro',
    Component: Step11Transition,
  },
  {
    id: 'infrequent-expenses',
    phase: 'Tu futuro',
    canContinue: (a) => a.infrequentExpenses.length > 0,
    Component: Step12InfrequentExpenses,
  },
  {
    id: 'goals',
    phase: 'Tu futuro',
    canContinue: (a) => a.goals.length > 0,
    Component: Step13Goals,
  },
  {
    id: 'additional-categories',
    phase: 'Tu futuro',
    showSkip: true,
    Component: Step14AdditionalCategories,
  },
  {
    id: 'category-list',
    phase: 'Tu plan',
    primaryLabel: 'Continuar al plan',
    wide: true,
    Component: Step15CategoryList,
  },
]
