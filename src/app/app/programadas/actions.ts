'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { safeError } from '@/lib/errors'
import { ensurePro } from '@/lib/billing/check-server'

export type Frequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'every2weeks'
  | 'monthly'
  | 'yearly'

export type ScheduledType = 'income' | 'expense'

export interface CreateScheduledInput {
  accountId: string
  categoryId: string | null
  payeeName: string
  amount: number // positive; sign comes from `type`
  type: ScheduledType
  memo: string | null
  frequency: Frequency
  nextDate: string // YYYY-MM-DD (first or next occurrence)
}

export interface UpdateScheduledInput extends CreateScheduledInput {
  id: string
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

const FREQUENCIES: Frequency[] = [
  'once',
  'daily',
  'weekly',
  'every2weeks',
  'monthly',
  'yearly',
]

function validate(input: CreateScheduledInput): string | null {
  if (!input.accountId) return 'Cuenta requerida'
  if (!isValidDate(input.nextDate)) return 'Fecha inválida'
  if (!input.payeeName.trim()) return 'Pagado a requerido'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Monto inválido'
  if (!FREQUENCIES.includes(input.frequency)) return 'Frecuencia inválida'
  if (input.type !== 'income' && input.type !== 'expense') return 'Tipo inválido'
  return null
}

function signedAmount(amount: number, type: ScheduledType): number {
  return type === 'income' ? Math.abs(amount) : -Math.abs(amount)
}

export async function createScheduled(input: CreateScheduledInput) {
  const gate = await ensurePro()
  if (!gate.ok) return { error: gate.error }
  const err = validate(input)
  if (err) return { error: err }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id')
    .eq('id', input.accountId)
    .single()
  if (!account) return { error: 'Cuenta no encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', account.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const { error: insertErr } = await supabase.from('scheduled_transactions').insert({
    budget_id: budget.id,
    account_id: input.accountId,
    category_id: input.categoryId,
    payee_name: input.payeeName.trim(),
    memo: input.memo?.trim() || null,
    amount: signedAmount(input.amount, input.type),
    frequency: input.frequency,
    next_date: input.nextDate,
    active: true,
    is_split: false,
  })
  if (insertErr) return { error: safeError(insertErr, 'programadas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function updateScheduled(input: UpdateScheduledInput) {
  const gate = await ensurePro()
  if (!gate.ok) return { error: gate.error }
  if (!input.id) return { error: 'ID requerido' }
  const err = validate(input)
  if (err) return { error: err }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('scheduled_transactions')
    .select('id, budget_id')
    .eq('id', input.id)
    .single()
  if (!existing) return { error: 'No encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, budget_id')
    .eq('id', input.accountId)
    .single()
  if (!account || account.budget_id !== existing.budget_id) {
    return { error: 'Cuenta inválida' }
  }

  if (input.categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('id', input.categoryId)
      .eq('budget_id', budget.id)
      .single()
    if (!cat) return { error: 'Categoría no encontrada' }
  }

  const { error: updateErr } = await supabase
    .from('scheduled_transactions')
    .update({
      account_id: input.accountId,
      category_id: input.categoryId,
      payee_name: input.payeeName.trim(),
      memo: input.memo?.trim() || null,
      amount: signedAmount(input.amount, input.type),
      frequency: input.frequency,
      next_date: input.nextDate,
    })
    .eq('id', input.id)
  if (updateErr) return { error: safeError(updateErr, 'programadas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function deleteScheduled(id: string) {
  if (!id) return { error: 'ID requerido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('scheduled_transactions')
    .select('id, budget_id')
    .eq('id', id)
    .single()
  if (!existing) return { error: 'No encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('scheduled_transactions')
    .delete()
    .eq('id', id)
  if (error) return { error: safeError(error, 'programadas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function toggleScheduledActive(id: string, active: boolean) {
  if (!id) return { error: 'ID requerido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('scheduled_transactions')
    .select('id, budget_id')
    .eq('id', id)
    .single()
  if (!existing) return { error: 'No encontrada' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', existing.budget_id)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('scheduled_transactions')
    .update({ active })
    .eq('id', id)
  if (error) return { error: safeError(error, 'programadas') }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ─── Materialization ─────────────────────────────────────────────
//
// La materialización en sí vive en Postgres (RPC
// materialize_due_scheduled) — corre como una sola transacción
// atómica para evitar INSERTs huérfanos si la conexión muere entre
// el INSERT de transactions y el UPDATE de next_date. (Auditoría
// calidad L4.)
//
// Este wrapper sigue exportado porque hay 2 call-sites legítimos:
//   1) /app/programadas/page.tsx — el usuario está mirando la lista
//      de programadas, queremos garantizar que esté materializada.
//   2) cron /api/cron/materialize-scheduled — ejecuta a diario para
//      todos los budgets, sacándolo del hot path del dashboard.
//      (Auditoría calidad L2.)

export async function materializeDue(budgetId: string) {
  if (!budgetId) return { created: 0 }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { created: 0 }

  // Verify ownership before invoking the RPC. The RPC itself relies on
  // RLS to scope the budget visible to this session.
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .maybeSingle()
  if (!budget) return { created: 0 }

  const { data: created, error } = await supabase.rpc(
    'materialize_due_scheduled',
    { p_budget_id: budgetId },
  )
  if (error) {
    console.error('[materializeDue] RPC failed', error)
    return { created: 0 }
  }

  return { created: typeof created === 'number' ? created : 0 }
}
