// Cálculos compartidos de presupuesto.
//
// Antes el cálculo de Ready-to-Assign vivía duplicado en layout.tsx
// y page.tsx (Resumen). Cada page-load de /app pagaba 2× el costo de
// leer todas las transacciones lifetime + assignments. (Auditoría de
// calidad L1.)
//
// Ahora un solo helper. Se llama desde el layout y el resultado se
// pasa por props/contexto. Si en algún momento el resultado se necesita
// solo (sin el contexto del layout), llamar directo a esta función.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseCurrency, convertAmount, DEFAULT_USD_TO_DOP_RATE, type Currency } from './money'

interface BudgetLite {
  id: string
  currency: string | null
  usd_to_dop_rate?: number | null
}

export interface ReadyToAssignResult {
  readyToAssign: number
  totalCash: number
  totalAssignedLifetime: number
  totalCategorizedActivity: number
}

const CASH_TYPES = new Set(['checking', 'savings', 'cash'])

/**
 * Calcula Ready-to-Assign = totalCash − Σ(category.available_lifetime).
 *
 * Esta es la fórmula YNAB: efectivo que aún no se ha etiquetado a una
 * categoría. Carry-over de balances no gastados + cobertura de
 * sobre-gasto caen naturalmente de esto.
 *
 * Hace 4 queries en paralelo. Diseñado para ser llamado UNA vez por
 * request — pasar el resultado por props/contexto si se necesita en
 * múltiples lugares.
 */
export async function computeReadyToAssign(
  supabase: SupabaseClient,
  budget: BudgetLite,
): Promise<ReadyToAssignResult> {
  const [accountsRes, assignsRes, txnsRes, subsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('balance, type, currency, closed')
      .eq('budget_id', budget.id),
    supabase.from('monthly_assignments').select('assigned').eq('budget_id', budget.id),
    supabase
      .from('transactions')
      .select('amount, category_id')
      .eq('budget_id', budget.id)
      .not('category_id', 'is', null),
    supabase
      .from('subtransactions')
      .select('amount, transactions!inner(budget_id)')
      .eq('transactions.budget_id', budget.id)
      .not('category_id', 'is', null),
  ])

  const budgetCurrency: Currency = parseCurrency(budget.currency)
  const fxRate = Number(budget.usd_to_dop_rate ?? DEFAULT_USD_TO_DOP_RATE)

  // Solo cuentas presupuestadas tipo "cash" cuentan para RtA. USD se
  // normaliza al currency del budget con el FX rate guardado.
  const totalCash = (accountsRes.data ?? [])
    .filter(
      (a) =>
        CASH_TYPES.has(a.type as string) && a.closed !== true,
    )
    .reduce((s, a) => {
      const accCurrency = parseCurrency(a.currency as string | null)
      const native = Number(a.balance)
      return s + convertAmount(native, accCurrency, budgetCurrency, fxRate)
    }, 0)

  const totalAssignedLifetime = (assignsRes.data ?? []).reduce(
    (s, a) => s + Number(a.assigned),
    0,
  )

  const totalCategorizedActivity =
    (txnsRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0) +
    (subsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

  const sumCategoryAvailable = totalAssignedLifetime + totalCategorizedActivity
  const readyToAssign =
    Math.round((totalCash - sumCategoryAvailable) * 100) / 100

  return {
    readyToAssign,
    totalCash: Math.round(totalCash * 100) / 100,
    totalAssignedLifetime: Math.round(totalAssignedLifetime * 100) / 100,
    totalCategorizedActivity:
      Math.round(totalCategorizedActivity * 100) / 100,
  }
}
