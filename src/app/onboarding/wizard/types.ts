import type { ComponentType } from 'react'

export type Motivation =
  | 'simplify'
  | 'pay_off_debt'
  | 'save_for_goal'
  | 'stop_paycheck_to_paycheck'
  | 'build_habits'
  | 'take_control'

export type Household = 'myself' | 'partner' | 'family' | 'roommates'
export type Housing = 'own' | 'rent' | 'other'
export type Mortgage = 'yes' | 'no' | 'paid_off'

export interface OnboardingAnswers {
  name: string
  motivation: Motivation | null
  household: Household | null
  housing: Housing | null
  mortgage: Mortgage | null
  debts: string[]
  transport: string[]
  regularSpending: string[]
  subscriptions: string[]
  infrequentExpenses: string[]
  goals: string[]
  additionalCategories: string[]
}

export interface StepDef {
  id: string
  phase: string
  primaryLabel?: string
  showSkip?: boolean
  canContinue?: (answers: OnboardingAnswers) => boolean
  Component: ComponentType
}

export const initialAnswers: OnboardingAnswers = {
  name: '',
  motivation: null,
  household: null,
  housing: null,
  mortgage: null,
  debts: [],
  transport: [],
  regularSpending: [],
  subscriptions: [],
  infrequentExpenses: [],
  goals: [],
  additionalCategories: [],
}
