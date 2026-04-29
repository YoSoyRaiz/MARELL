'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    .eq('created_by', user.id)
    .single()
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
  if (insertErr) return { error: insertErr.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function updateScheduled(input: UpdateScheduledInput) {
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
    .eq('created_by', user.id)
    .single()
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
  if (updateErr) return { error: updateErr.message }

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
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('scheduled_transactions')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }

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
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('scheduled_transactions')
    .update({ active })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// ─── Frequency math ─────────────────────────────────────────────

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function advanceDate(iso: string, frequency: Frequency): string {
  const d = parseISO(iso)
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'every2weeks':
      d.setDate(d.getDate() + 14)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
    case 'once':
      return iso
  }
  return toISO(d)
}

// ─── Materialization (lazy: runs on /app load) ───────────────────

export async function materializeDue(budgetId: string) {
  if (!budgetId) return { created: 0 }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { created: 0 }

  // Verify ownership
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { created: 0 }

  const today = toISO(new Date())

  const { data: due } = await supabase
    .from('scheduled_transactions')
    .select(
      'id, account_id, category_id, payee_name, memo, amount, frequency, next_date',
    )
    .eq('budget_id', budgetId)
    .eq('active', true)
    .lte('next_date', today)

  if (!due || due.length === 0) return { created: 0 }

  let created = 0

  // Process each due scheduled txn — may fire multiple times if it's been
  // many cycles since last materialization.
  for (const s of due) {
    let nextDate = s.next_date as string
    const frequency = s.frequency as Frequency
    let safety = 0
    const cap = 366 // hard cap on iterations per scheduled per call

    while (nextDate <= today && safety < cap) {
      // Read latest balance just-in-time so successive fires stack correctly.
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', s.account_id as string)
        .single()
      if (!account) break

      const amount = Number(s.amount)

      const { error: insertErr } = await supabase.from('transactions').insert({
        account_id: s.account_id,
        budget_id: budgetId,
        date: nextDate,
        payee_name: s.payee_name,
        category_id: s.category_id,
        memo: s.memo,
        amount,
        cleared: 'uncleared',
        approved: true,
      })
      if (insertErr) break

      const newBalance = Math.round((Number(account.balance) + amount) * 100) / 100
      await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', s.account_id as string)

      created += 1

      if (frequency === 'once') {
        // Disable after firing once
        await supabase
          .from('scheduled_transactions')
          .update({ active: false })
          .eq('id', s.id as string)
        break
      }

      nextDate = advanceDate(nextDate, frequency)
      safety += 1
    }

    if (frequency !== 'once' && nextDate !== s.next_date) {
      await supabase
        .from('scheduled_transactions')
        .update({ next_date: nextDate })
        .eq('id', s.id as string)
    }
  }

  if (created > 0) {
    revalidatePath('/app', 'layout')
  }
  return { created }
}
