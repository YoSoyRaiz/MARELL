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

export type Debt =
  | 'credit_card'
  | 'auto'
  | 'student'
  | 'personal'
  | 'medical'
  | 'bnpl'
  | 'none'

export type Transport =
  | 'car'
  | 'bike'
  | 'walk'
  | 'public'
  | 'rideshare'
  | 'motorcycle'
  | 'wheelchair'

export type RegularSpending =
  | 'groceries'
  | 'tv_internet'
  | 'personal_care'
  | 'clothing'
  | 'storage'

export type Subscription = 'music' | 'streaming' | 'fitness' | 'other' | 'none'

export type InfrequentExpense = 'credit_card_annual' | 'medical' | 'taxes' | 'none'

export type Goal =
  | 'emergency_fund'
  | 'vacation'
  | 'new_car'
  | 'new_home'
  | 'wedding'
  | 'baby'
  | 'retirement'
  | 'none'

export type AdditionalCategory =
  | 'dining_out'
  | 'entertainment'
  | 'hobbies'
  | 'charity'
  | 'gifts'
  | 'home_decor'

export interface OnboardingAnswers {
  name: string
  motivation: Motivation | null
  household: Household | null
  housing: Housing | null
  mortgage: Mortgage | null
  debts: Debt[]
  transport: Transport[]
  regularSpending: RegularSpending[]
  subscriptions: Subscription[]
  infrequentExpenses: InfrequentExpense[]
  goals: Goal[]
  additionalCategories: AdditionalCategory[]
}

export interface StepDef {
  id: string
  phase: string
  primaryLabel?: string
  showSkip?: boolean
  wide?: boolean
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
