'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveBudgetId } from '@/lib/budget/active'
import { safeError } from '@/lib/errors'
import { ensurePro } from '@/lib/billing/check-server'

export type GoalType = 'monthly_spending' | 'savings_balance' | 'needed_by'

export interface UpdateGoalInput {
  categoryId: string
  goalType: GoalType
  goalAmount: number
  goalDate: string | null // YYYY-MM-DD
  customName?: string | null // optional rename
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function updateGoal(input: UpdateGoalInput) {
  const gate = await ensurePro()
  if (!gate.ok) return { error: gate.error }
  if (!input.categoryId) return { error: 'Categoría requerida' }
  if (
    input.goalType !== 'monthly_spending' &&
    input.goalType !== 'savings_balance' &&
    input.goalType !== 'needed_by'
  ) {
    return { error: 'Tipo de meta inválido' }
  }
  if (!Number.isFinite(input.goalAmount) || input.goalAmount <= 0) {
    return { error: 'Monto inválido' }
  }
  if (input.goalDate !== null && !isValidDate(input.goalDate)) {
    return { error: 'Fecha inválida' }
  }
  if (input.goalType === 'needed_by' && !input.goalDate) {
    return { error: 'Las metas con fecha requieren una fecha objetivo' }
  }

  const trimmedName = input.customName?.trim() ?? ''
  if (trimmedName.length > 60) {
    return { error: 'Nombre demasiado largo (máx. 60)' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, budget_id, name')
    .eq('id', input.categoryId)
    .single()
  if (!cat) return { error: 'Categoría no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', cat.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const rounded = Math.round(input.goalAmount * 100) / 100

  const update = {
    goal_type: input.goalType,
    goal_amount: rounded,
    goal_monthly: input.goalType === 'monthly_spending' ? rounded : null,
    goal_date: input.goalDate,
    ...(trimmedName && trimmedName !== cat.name ? { name: trimmedName } : {}),
  }

  const { error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', input.categoryId)

  if (error) return { error: safeError(error, 'metas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Crear meta nueva (sin promover categoría existente) ─────────
//
// Crea una categoría nueva dentro del grupo "Metas" con los campos de
// meta ya seteados. Si el budget no tiene el grupo "Metas" todavía
// (usuario que no eligió ninguna meta en onboarding), lo crea on-the-fly.
//
// Difiere de `updateGoal` que mutaba una categoría existente para
// "promoverla" a meta — esa lógica se eliminó del modal porque
// conceptualmente las metas son su propio bucket, no etiquetas sobre
// categorías de gasto.

export interface CreateMetaInput {
  name: string
  goalType: 'savings_balance' | 'needed_by'
  goalAmount: number
  goalDate: string | null
}

export async function createMeta(input: CreateMetaInput) {
  const gate = await ensurePro()
  if (!gate.ok) return { error: gate.error }

  const trimmed = input.name.trim()
  if (!trimmed) return { error: 'Nombre requerido' }
  if (trimmed.length > 60) return { error: 'Nombre demasiado largo (máx. 60)' }
  if (input.goalType !== 'savings_balance' && input.goalType !== 'needed_by') {
    return { error: 'Tipo de meta inválido' }
  }
  if (!Number.isFinite(input.goalAmount) || input.goalAmount <= 0) {
    return { error: 'Monto inválido' }
  }
  if (input.goalDate !== null && !isValidDate(input.goalDate)) {
    return { error: 'Fecha inválida' }
  }
  if (input.goalType === 'needed_by' && !input.goalDate) {
    return { error: 'Las metas con fecha requieren una fecha objetivo' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Primer budget del user (mismo patrón que el resto del archivo).
  const { data: budget } = await (async () => {
    const { budgetId: __activeBudgetId } = await getActiveBudgetId(supabase)
    if (!__activeBudgetId) return { data: null }
    return supabase
      .from('budgets')
      .select('id')
      .eq('id', __activeBudgetId)
      .maybeSingle()
  })()
  if (!budget) return { error: 'Sin presupuesto' }

  // Find-or-create del grupo "Metas". El onboarding solo crea este
  // grupo si el usuario eligió metas en el wizard — los demás casos
  // necesitan crearlo on-the-fly aquí para que la inserción de la
  // categoría tenga dónde colgarse.
  let metasGroupId: string | null = null
  const { data: existingGroup } = await supabase
    .from('category_groups')
    .select('id')
    .eq('budget_id', budget.id)
    .eq('name', 'Metas')
    .maybeSingle()

  if (existingGroup) {
    metasGroupId = existingGroup.id as string
  } else {
    // Sort_order al final del listado actual.
    const { data: maxGroupRow } = await supabase
      .from('category_groups')
      .select('sort_order')
      .eq('budget_id', budget.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextGroupSort = Number(maxGroupRow?.sort_order ?? 0) + 1
    const { data: newGroup, error: groupErr } = await supabase
      .from('category_groups')
      .insert({
        budget_id: budget.id,
        name: 'Metas',
        sort_order: nextGroupSort,
      })
      .select('id')
      .single()
    if (groupErr || !newGroup) {
      return { error: groupErr?.message ?? 'Error creando grupo Metas' }
    }
    metasGroupId = newGroup.id as string
  }

  // sort_order al final del grupo Metas.
  const { data: maxCatRow } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('budget_id', budget.id)
    .eq('group_id', metasGroupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextCatSort = Number(maxCatRow?.sort_order ?? 0) + 1

  const rounded = Math.round(input.goalAmount * 100) / 100

  const { error: insertErr } = await supabase.from('categories').insert({
    budget_id: budget.id,
    group_id: metasGroupId,
    name: trimmed,
    sort_order: nextCatSort,
    goal_type: input.goalType,
    goal_amount: rounded,
    goal_monthly: null, // monthly_spending no aplica aquí — savings/needed_by
    goal_date: input.goalDate,
  })

  if (insertErr) return { error: safeError(insertErr, 'metas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ── Sugerencia inteligente de Fondo de emergencia ────────────────
//
// La regla estándar internacional es 3-6 meses de gastos típicos. Pero
// "gastos típicos" varía mucho por usuario, así que calculamos el
// promedio mensual de los últimos 3/6/12 meses (cualquiera que tenga
// suficiente data) y lo multiplicamos por el factor que pida el UI.
//
// Solo cuenta transacciones de gasto reales (amount < 0) en cuentas
// budget — excluye transferencias internas y movimientos en tracking
// accounts (inversiones). Si el usuario no tiene historial todavía,
// devolvemos null y el cliente cae a su propia estimación basada en
// el onboarding o input manual.

export interface EmergencyFundSuggestion {
  monthlyAverage: number
  // Cuántos meses de historial usamos para el promedio (3, 6 o 12).
  // null = no había data suficiente.
  basedOnMonths: number | null
  // Sugerencias listas para clickear.
  options: { months: number; amount: number; label: string }[]
}

export async function suggestEmergencyFundAmount(): Promise<EmergencyFundSuggestion> {
  const empty: EmergencyFundSuggestion = {
    monthlyAverage: 0,
    basedOnMonths: null,
    options: [],
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return empty

  const { data: budget } = await (async () => {
    const { budgetId: __activeBudgetId } = await getActiveBudgetId(supabase)
    if (!__activeBudgetId) return { data: null }
    return supabase
      .from('budgets')
      .select('id')
      .eq('id', __activeBudgetId)
      .maybeSingle()
  })()
  if (!budget) return empty

  // Pull last 12 months of expenses + the accounts they belong to, so
  // we can filter out transfers and tracking accounts in memory (no
  // join headaches).
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 12)
  cutoff.setDate(1)
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  const [txnRes, accRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('date, amount, account_id, transfer_account_id')
      .eq('budget_id', budget.id)
      .lt('amount', 0)
      .gte('date', cutoffISO),
    supabase
      .from('accounts')
      .select('id, is_budget_account')
      .eq('budget_id', budget.id),
  ])

  const trackingAccountIds = new Set(
    (accRes.data ?? [])
      .filter((a) => a.is_budget_account === false)
      .map((a) => a.id as string),
  )

  // Group by YYYY-MM and sum absolute gastos. Skip transfers (internas)
  // y transacciones de tracking accounts (inversiones, no son gasto real).
  const monthlyTotals = new Map<string, number>()
  for (const t of txnRes.data ?? []) {
    if (t.transfer_account_id) continue
    if (trackingAccountIds.has(t.account_id as string)) continue
    const month = (t.date as string).slice(0, 7) // YYYY-MM
    const prev = monthlyTotals.get(month) ?? 0
    monthlyTotals.set(month, prev + Math.abs(Number(t.amount)))
  }

  // Pick a window: prefer 3 most recent complete months, fall back to
  // 6, then 12, then nothing. "Complete" doesn't filter for now —
  // partial-month data gets averaged in, which is OK for a suggestion.
  const sortedMonths = Array.from(monthlyTotals.keys()).sort().reverse()

  let avg = 0
  let usedMonths: number | null = null
  for (const window of [3, 6, 12]) {
    const slice = sortedMonths.slice(0, window)
    if (slice.length >= Math.min(window, 3)) {
      const sum = slice.reduce((s, m) => s + (monthlyTotals.get(m) ?? 0), 0)
      avg = sum / slice.length
      usedMonths = slice.length
      break
    }
  }

  if (avg <= 0 || usedMonths === null) return empty

  const rounded = Math.round(avg * 100) / 100
  return {
    monthlyAverage: rounded,
    basedOnMonths: usedMonths,
    options: [
      { months: 3, amount: Math.round(rounded * 3 * 100) / 100, label: '3 meses (mínimo)' },
      { months: 6, amount: Math.round(rounded * 6 * 100) / 100, label: '6 meses (recomendado)' },
      { months: 12, amount: Math.round(rounded * 12 * 100) / 100, label: '12 meses (conservador)' },
    ],
  }
}

export async function clearGoal(categoryId: string) {
  if (!categoryId) return { error: 'Categoría requerida' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, budget_id')
    .eq('id', categoryId)
    .single()
  if (!cat) return { error: 'Categoría no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', cat.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('categories')
    .update({
      goal_type: null,
      goal_amount: null,
      goal_monthly: null,
      goal_date: null,
    })
    .eq('id', categoryId)

  if (error) return { error: safeError(error, 'metas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}
