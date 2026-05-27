/**
 * Cálculo y generación de transacciones de interés mensual sobre
 * cuentas de deuda. Lógica compartida entre:
 *
 *   - El server action manual (src/app/app/cuentas/actions.ts)
 *     que el usuario dispara con un botón
 *   - El cron mensual (src/app/api/cron/generate-interest/route.ts)
 *     que corre automáticamente el día 1 de cada mes
 *
 * Identifica las txns generadas con payee_name='Intereses estimados'
 * para dedup idempotente y para que aparezcan en Income vs Expense
 * (sí cuentan como gasto real).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DEBT_TYPES_FOR_INTEREST = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

export interface InterestGenerationDetail {
  accountName: string
  status: 'generated' | 'skipped'
  reason?: string
  amount?: number
}

export interface InterestGenerationResult {
  generated: number
  skipped: number
  details: InterestGenerationDetail[]
}

/**
 * Calcula la fecha objetivo del mes y delega en el helper de
 * generación. Toma el último día del mes target como fecha de la
 * txn — esa es la convención contable estándar para reconocer
 * intereses del período cerrado.
 */
export async function generateInterestForBudget(
  supabase: SupabaseClient,
  budgetId: string,
  monthYYYYMM: string,
): Promise<InterestGenerationResult> {
  const { data: debts } = await supabase
    .from('accounts')
    .select('id, name, type, balance, interest_rate_apr')
    .eq('budget_id', budgetId)
    .eq('closed', false)
    .not('interest_rate_apr', 'is', null)
    .gt('interest_rate_apr', 0)
  if (!debts || debts.length === 0) {
    return { generated: 0, skipped: 0, details: [] }
  }

  const targetDebts = debts.filter((a: { type: string }) =>
    DEBT_TYPES_FOR_INTEREST.has(a.type),
  )
  if (targetDebts.length === 0) {
    return { generated: 0, skipped: 0, details: [] }
  }

  // Último día del mes target = fecha contable estándar
  const [y, m] = monthYYYYMM.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const txnDate = `${monthYYYYMM}-${String(lastDay).padStart(2, '0')}`
  const firstDay = `${monthYYYYMM}-01`

  // Dedup: una sola query a buscar interés ya generado para esos
  // accounts en ese mes
  const { data: existing } = await supabase
    .from('transactions')
    .select('account_id')
    .eq('budget_id', budgetId)
    .eq('payee_name', 'Intereses estimados')
    .gte('date', firstDay)
    .lte('date', txnDate)
    .in(
      'account_id',
      targetDebts.map((d: { id: string }) => d.id),
    )

  const alreadyGenerated = new Set(
    (existing ?? []).map((e: { account_id: string }) => e.account_id),
  )

  const details: InterestGenerationDetail[] = []
  const toInsert: Array<{
    account_id: string
    budget_id: string
    date: string
    payee_name: string
    memo: string
    amount: number
    category_id: null
    cleared: 'uncleared'
    approved: true
  }> = []

  for (const acc of targetDebts as Array<{
    id: string
    name: string
    type: string
    balance: number
    interest_rate_apr: number
  }>) {
    if (alreadyGenerated.has(acc.id)) {
      details.push({ accountName: acc.name, status: 'skipped', reason: 'ya existe' })
      continue
    }
    const balance = Number(acc.balance)
    const apr = Number(acc.interest_rate_apr) / 100
    // Balance es negativo (deuda); abs para calcular monto, signo
    // negativo porque es gasto que aumenta deuda.
    const monthlyInterest =
      -Math.round(((Math.abs(balance) * apr) / 12) * 100) / 100
    if (Math.abs(monthlyInterest) < 0.005) {
      details.push({ accountName: acc.name, status: 'skipped', reason: 'monto ínfimo' })
      continue
    }
    toInsert.push({
      account_id: acc.id,
      budget_id: budgetId,
      date: txnDate,
      payee_name: 'Intereses estimados',
      memo: `Estimación ${monthYYYYMM} · ${(apr * 100).toFixed(2)}% APR ÷ 12`,
      amount: monthlyInterest,
      category_id: null,
      cleared: 'uncleared',
      approved: true,
    })
    details.push({
      accountName: acc.name,
      status: 'generated',
      amount: monthlyInterest,
    })
  }

  if (toInsert.length > 0) {
    await supabase.from('transactions').insert(toInsert)
  }

  return {
    generated: toInsert.length,
    skipped: details.filter((d) => d.status === 'skipped').length,
    details,
  }
}

/**
 * Helper para calcular qué mes generar por default: el mes pasado.
 * La convención contable es generar intereses del período que ya
 * cerró, no del actual.
 */
export function previousMonthDR(): string {
  const now = new Date()
  const drNow = new Date(now.getTime() - 4 * 60 * 60 * 1000)
  const prev = new Date(
    drNow.getUTCFullYear(),
    drNow.getUTCMonth() - 1,
    1,
  )
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}
