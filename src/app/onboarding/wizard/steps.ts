import type { StepDef } from './types'
import { Step01Name } from './steps/Step01Name'
import { Step02Motivation } from './steps/Step02Motivation'
import { Step04Household } from './steps/Step04Household'
import { Step05HousingCombo } from './steps/Step05HousingCombo'
import { Step07Lifestyle } from './steps/Step07Lifestyle'
import { Step13GoalsAndExtras } from './steps/Step13GoalsAndExtras'
import { Step15CategoryList } from './steps/Step15CategoryList'
import { Step17Targets } from './steps/Step17Targets'
import { Step18AddAccountsIntro } from './steps/Step18AddAccountsIntro'
import { Step19AccountForm } from './steps/Step19AccountForm'
import { Step20AccountsRecap } from './steps/Step20AccountsRecap'
import { Step22SavingsAllocation } from './steps/Step22SavingsAllocation'
import { Step23ZeroBased } from './steps/Step23ZeroBased'
import { Step28Final } from './steps/Step28Final'

/**
 * Onboarding step list — 14 pasos.
 *
 * Reducido desde 24 pasos originales (audit 2026-05-14) absorbiendo
 * intersticiales + agrupando multi-selects en acordeón + fusionando
 * decisiones cohesivas (vivienda/hipoteca, metas/extras) sin perder
 * personalización para el público dominicano. Specs originales y
 * justificación de cada fusión están en el commit message del refactor.
 */
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
    id: 'household',
    phase: 'Tu hogar',
    canContinue: (a) => a.household !== null,
    Component: Step04Household,
  },
  {
    id: 'housing-combo',
    phase: 'Tu hogar',
    // Vivienda requerido siempre; hipoteca requerida SOLO si es propietario.
    // Para no-propietarios pre-seteamos mortgage='no' en el click handler.
    canContinue: (a) =>
      a.housing !== null && (a.housing !== 'own' || a.mortgage !== null),
    Component: Step05HousingCombo,
  },
  {
    id: 'lifestyle',
    phase: 'Tu día a día',
    // Acordeón de 5 secciones. Las 3 con opción 'none' son requeridas
    // (debts, subscriptions, infrequent) — el user explícitamente
    // marca "ninguna" si no aplica. Transport y regular son opcionales.
    canContinue: (a) =>
      a.debts.length > 0 &&
      a.subscriptions.length > 0 &&
      a.infrequentExpenses.length > 0,
    Component: Step07Lifestyle,
  },
  {
    id: 'goals-extras',
    phase: 'Tu futuro',
    // Goals requerido (con 'none'), additional opcional.
    canContinue: (a) => a.goals.length > 0,
    Component: Step13GoalsAndExtras,
  },
  {
    id: 'category-list',
    phase: 'Tu plan',
    primaryLabel: 'Personalizar plan',
    wide: true,
    Component: Step15CategoryList,
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
