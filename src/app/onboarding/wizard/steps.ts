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
import { Step16WelcomePlan } from './steps/Step16WelcomePlan'
import { Step17Targets } from './steps/Step17Targets'
import { Step18AddAccountsIntro } from './steps/Step18AddAccountsIntro'
import { Step19AccountForm } from './steps/Step19AccountForm'
import { Step20AccountsRecap } from './steps/Step20AccountsRecap'
import { Step21FundIntro } from './steps/Step21FundIntro'
import { Step22SavingsAllocation } from './steps/Step22SavingsAllocation'
import { Step23ZeroBased } from './steps/Step23ZeroBased'
import { Step28Final } from './steps/Step28Final'

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
    primaryLabel: 'Personalizar plan',
    wide: true,
    Component: Step15CategoryList,
  },
  {
    id: 'welcome-plan',
    phase: 'Paso 1 de 3 · Personalizar plan',
    Component: Step16WelcomePlan,
  },
  {
    id: 'targets',
    phase: 'Paso 1 de 3 · Personalizar plan',
    primaryLabel: 'Continuar',
    wide: true,
    Component: Step17Targets,
  },
  {
    id: 'accounts-intro',
    phase: 'Paso 2 de 3 · Cuentas',
    Component: Step18AddAccountsIntro,
  },
  {
    id: 'account-form',
    phase: 'Paso 2 de 3 · Cuentas',
    hideContinue: true,
    Component: Step19AccountForm,
  },
  {
    id: 'accounts-recap',
    phase: 'Paso 2 de 3 · Cuentas',
    primaryLabel: 'Continuar',
    canContinue: (a) => a.accounts.length >= 1,
    Component: Step20AccountsRecap,
  },
  {
    id: 'fund-intro',
    phase: 'Paso 3 de 3 · Asignación',
    Component: Step21FundIntro,
  },
  {
    id: 'savings-allocation',
    phase: 'Paso 3 de 3 · Asignación',
    Component: Step22SavingsAllocation,
  },
  {
    id: 'plan-preview',
    phase: 'Paso 3 de 3 · Asignación',
    primaryLabel: 'Hora de asignar',
    Component: Step23ZeroBased,
  },
  {
    id: 'final',
    phase: '¡Listo!',
    hideContinue: true,
    Component: Step28Final,
  },
]
