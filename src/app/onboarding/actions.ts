'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateCategories } from './wizard/categoryGenerator'
import type { AccountType, OnboardingAnswers } from './wizard/types'

const TRIAL_DAYS = 30

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const keyOf = (groupName: string, itemName: string) => `${groupName}::${itemName}`

// Map wizard's 13 account types → DB's restricted set
// (DB schema comment: checking | savings | credit_card | cash | investment | mortgage | other)
const ACCOUNT_TYPE_DB_MAP: Record<AccountType, string> = {
  checking: 'checking',
  savings: 'savings',
  cash: 'cash',
  credit_card: 'credit_card',
  line_of_credit: 'credit_card',
  mortgage: 'mortgage',
  auto_loan: 'other',
  student_loan: 'other',
  personal_loan: 'other',
  medical_debt: 'other',
  other_debt: 'other',
  asset: 'investment',
  liability: 'other',
}

const DEBT_TYPES: AccountType[] = [
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
]

export async function completeOnboarding(answers: OnboardingAnswers) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Crear el budget
  const { data: budget, error: bErr } = await supabase
    .from('budgets')
    .insert({
      name: 'Mi presupuesto',
      currency: 'DOP',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (bErr || !budget) return { error: bErr?.message ?? 'Error creando presupuesto' }

  // 2. Owner como miembro
  const { error: mErr } = await supabase.from('budget_members').insert({
    budget_id: budget.id,
    user_id: user.id,
    role: 'owner',
  })
  if (mErr) return { error: mErr.message }

  // 3. Generar grupos + categorías dinámicas desde las respuestas
  const groups = generateCategories(answers)
  const groupIdByName: Record<string, string> = {}

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const { data: row, error: gErr } = await supabase
      .from('category_groups')
      .insert({
        budget_id: budget.id,
        name: g.name,
        sort_order: i + 1,
      })
      .select('id')
      .single()
    if (gErr || !row) return { error: gErr?.message ?? 'Error creando grupo' }
    groupIdByName[g.name] = row.id
  }

  // 4. Insertar categorías
  const categoryInserts = groups.flatMap((g) =>
    g.items.map((item, idx) => ({
      group_id: groupIdByName[g.name],
      budget_id: budget.id,
      name: item.name,
      sort_order: idx + 1,
    })),
  )
  let catIdByKey: Record<string, string> = {}
  if (categoryInserts.length > 0) {
    const { data: insertedCats, error: cErr } = await supabase
      .from('categories')
      .insert(categoryInserts)
      .select('id, name, group_id')
    if (cErr || !insertedCats) return { error: cErr?.message ?? 'Error creando categorías' }

    for (const cat of insertedCats) {
      const groupName = Object.keys(groupIdByName).find(
        (gn) => groupIdByName[gn] === cat.group_id,
      )
      if (groupName) catIdByKey[keyOf(groupName, cat.name)] = cat.id
    }
  }

  // 5. Insertar accounts
  if (answers.accounts.length > 0) {
    const accountInserts = answers.accounts.map((a, i) => {
      const isDebt = DEBT_TYPES.includes(a.type)
      const isTracking = a.type === 'asset' || a.type === 'liability'
      return {
        budget_id: budget.id,
        name: a.name,
        type: ACCOUNT_TYPE_DB_MAP[a.type],
        currency: 'DOP',
        balance: isDebt ? -Math.abs(a.balance) : a.balance,
        is_budget_account: !isTracking,
        sort_order: i,
      }
    })
    const { error: aErr } = await supabase.from('accounts').insert(accountInserts)
    if (aErr) return { error: aErr.message }
  }

  // 6. Asignaciones mensuales (zero-based)
  const month = currentMonth()
  const assignmentInserts = Object.entries(answers.assignments)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([key, amount]) => {
      const catId = catIdByKey[key]
      if (!catId) return null
      return { budget_id: budget.id, category_id: catId, month, assigned: amount as number }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (assignmentInserts.length > 0) {
    const { error: aaErr } = await supabase
      .from('monthly_assignments')
      .insert(assignmentInserts)
    if (aaErr) return { error: aaErr.message }
  }

  // 7. Aplicar metas mensuales (targets) como goal_type='monthly_spending'
  for (const [key, target] of Object.entries(answers.targets)) {
    if (typeof target !== 'number' || target <= 0) continue
    const catId = catIdByKey[key]
    if (!catId) continue
    await supabase
      .from('categories')
      .update({
        goal_type: 'monthly_spending',
        goal_amount: target,
        goal_monthly: target,
      })
      .eq('id', catId)
  }

  // 8. Marcar perfil como onboarded + iniciar trial
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  const trimmedName = answers.name?.trim()
  const { error: pErr } = await supabase
    .from('profiles')
    .update({
      onboarded: true,
      plan: 'trial',
      trial_ends_at: trialEnd.toISOString(),
      ...(trimmedName ? { display_name: trimmedName } : {}),
    })
    .eq('id', user.id)
  if (pErr) return { error: pErr.message }

  revalidatePath('/', 'layout')
  redirect('/app')
}
