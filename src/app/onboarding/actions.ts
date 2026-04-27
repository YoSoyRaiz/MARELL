'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type IncomeFrequency = 'weekly' | 'biweekly' | 'monthly' | 'variable'
export type Currency = 'DOP' | 'USD'

export type DebtInput = {
  name: string
  balance: number
  interestRate?: number
}

export type SavingsGoalInput = {
  name: string
  targetAmount: number
  targetDate?: string
}

export type OnboardingPayload = {
  budgetName: string
  currency: Currency
  incomeFrequency: IncomeFrequency
  monthlyIncome: number
  primaryAccountName: string
  primaryAccountBalance: number
  debts: DebtInput[]
  goals: SavingsGoalInput[]
}

const CURRENT_MONTH = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const TRIAL_DAYS = 30

// Porcentajes sugeridos sobre el ingreso mensual (estilo YNAB / 50-30-20 mix)
const SUGGESTED_ALLOCATIONS: Record<string, number> = {
  'Renta / Hipoteca': 0.30,
  'Electricidad (EDENORTE/EDESUR)': 0.04,
  'Agua (CAASD)': 0.01,
  'Internet': 0.02,
  'Teléfono móvil': 0.02,
  'Supermercado / Colmado': 0.12,
  'Gasolina / Transporte': 0.06,
  'Restaurantes y salidas': 0.05,
  'Entretenimiento': 0.03,
  'Fondo de Emergencia': 0.10,
  'Inversión': 0.05,
}

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Crear el budget
  const { data: budget, error: bErr } = await supabase
    .from('budgets')
    .insert({
      name: payload.budgetName || 'Mi presupuesto',
      currency: payload.currency,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (bErr || !budget) return { error: bErr?.message ?? 'Error creando presupuesto' }

  // 2. Owner como miembro del presupuesto
  const { error: mErr } = await supabase.from('budget_members').insert({
    budget_id: budget.id,
    user_id: user.id,
    role: 'owner',
  })
  if (mErr) return { error: mErr.message }

  // 3. Categorías default vía función SQL
  const { error: cErr } = await supabase.rpc('create_default_categories', {
    p_budget_id: budget.id,
  })
  if (cErr) return { error: cErr.message }

  // 4. Cuenta principal
  const { error: aErr } = await supabase.from('accounts').insert({
    budget_id: budget.id,
    name: payload.primaryAccountName || 'Cuenta principal',
    type: 'checking',
    currency: payload.currency,
    balance: payload.primaryAccountBalance || 0,
    is_budget_account: true,
    sort_order: 0,
  })
  if (aErr) return { error: aErr.message }

  // 5. Cuentas para deudas (tarjetas/préstamos)
  if (payload.debts.length > 0) {
    const debtAccounts = payload.debts.map((d, i) => ({
      budget_id: budget.id,
      name: d.name,
      type: 'credit_card' as const,
      currency: payload.currency,
      balance: -Math.abs(d.balance),
      is_budget_account: true,
      sort_order: i + 1,
    }))
    const { error: dErr } = await supabase.from('accounts').insert(debtAccounts)
    if (dErr) return { error: dErr.message }
  }

  // 6. Asignaciones mensuales sugeridas para el mes actual
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name')
    .eq('budget_id', budget.id)

  if (cats) {
    const month = CURRENT_MONTH()
    const assignments = cats
      .filter((c) => SUGGESTED_ALLOCATIONS[c.name] !== undefined)
      .map((c) => ({
        budget_id: budget.id,
        category_id: c.id,
        month,
        assigned: Math.round(payload.monthlyIncome * SUGGESTED_ALLOCATIONS[c.name] * 100) / 100,
      }))
    if (assignments.length > 0) {
      await supabase.from('monthly_assignments').insert(assignments)
    }

    // Setear metas para los goals del usuario
    if (payload.goals.length > 0) {
      const emergencyCat = cats.find((c) => c.name === 'Fondo de Emergencia')
      for (const g of payload.goals) {
        const targetCat =
          cats.find((c) => c.name.toLowerCase() === g.name.toLowerCase()) ??
          emergencyCat
        if (!targetCat) continue
        await supabase
          .from('categories')
          .update({
            goal_type: 'savings_balance',
            goal_amount: g.targetAmount,
            goal_date: g.targetDate ?? null,
          })
          .eq('id', targetCat.id)
      }
    }
  }

  // 7. Marcar perfil como onboarded + iniciar trial de 30 días
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  const { error: pErr } = await supabase
    .from('profiles')
    .update({
      onboarded: true,
      plan: 'trial',
      trial_ends_at: trialEnd.toISOString(),
    })
    .eq('id', user.id)
  if (pErr) return { error: pErr.message }

  revalidatePath('/', 'layout')
  redirect('/app')
}
