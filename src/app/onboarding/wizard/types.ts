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

// ── Phase 2 ────────────────────────────────────────────

export type AccountType =
  // cash
  | 'checking'
  | 'savings'
  | 'cash'
  // credit
  | 'credit_card'
  | 'line_of_credit'
  // mortgages & loans
  | 'mortgage'
  | 'auto_loan'
  | 'student_loan'
  | 'personal_loan'
  | 'medical_debt'
  | 'other_debt'
  // tracking
  | 'asset'
  | 'liability'

export type AccountCategory = 'cash' | 'credit' | 'loan' | 'tracking'

export interface AccountInput {
  id: string
  name: string
  type: AccountType
  balance: number
  interestRate?: number
}

// Targets and assignments are keyed by `${groupName}::${categoryName}`
export type CategoryKey = string

export interface OnboardingAnswers {
  // Phase 1
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
  // Phase 2
  targets: Record<CategoryKey, number>
  accounts: AccountInput[]
  assignments: Record<CategoryKey, number>
  savingsAside: Record<string, boolean> // accountId -> aside
}

export interface StepDef {
  id: string
  phase: string
  primaryLabel?: string
  showSkip?: boolean
  wide?: boolean
  hideContinue?: boolean
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
  targets: {},
  accounts: [],
  assignments: {},
  savingsAside: {},
}

export function accountCategoryFromType(t: AccountType): AccountCategory {
  if (t === 'checking' || t === 'savings' || t === 'cash') return 'cash'
  if (t === 'credit_card' || t === 'line_of_credit') return 'credit'
  if (t === 'asset' || t === 'liability') return 'tracking'
  return 'loan'
}

export function isDebtType(t: AccountType): boolean {
  return accountCategoryFromType(t) === 'loan' || t === 'credit_card' || t === 'line_of_credit'
}
