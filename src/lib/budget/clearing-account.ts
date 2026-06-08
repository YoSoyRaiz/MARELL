// Helper: cuenta puente / clearing por budget.
//
// La cuenta clearing contrabalancea transferencias entre cuentas para
// evitar duplicar gastos/ingresos cuando el auditor importa ambos lados
// de la transferencia (estado BHD y estado Popular). Lazy: se crea on
// demand cuando el primer transfer se marca.
//
// No es server action — es helper para usar dentro de server actions.

import type { SupabaseClient } from '@supabase/supabase-js'

export const CLEARING_ACCOUNT_NAME = 'Transferencias en tránsito'

/**
 * Devuelve el id de la cuenta clearing del budget. Si no existe la
 * crea con default settings. Idempotente.
 *
 * Convención: solo una cuenta clearing por budget (la query devuelve la
 * primera por created_at). Si el cliente ya tiene una creada manual
 * con type='clearing', la reusamos.
 */
export async function getOrCreateClearingAccount(
  supabase: SupabaseClient,
  budgetId: string,
  currency: 'DOP' | 'USD' = 'DOP',
): Promise<{ id: string } | { error: string }> {
  // 1. ¿Ya existe?
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('budget_id', budgetId)
    .eq('type', 'clearing')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) return { id: existing.id as string }

  // 2. Crear la cuenta. sort_order alto para que aparezca al final
  // de la lista (donde el usuario menos la mira). is_budget_account
  // = false para que no aparezca en el cálculo del Ready to Assign
  // ni en patrimonio neto.
  const { data: created, error } = await supabase
    .from('accounts')
    .insert({
      budget_id: budgetId,
      name: CLEARING_ACCOUNT_NAME,
      type: 'clearing' as never,
      currency,
      balance: 0,
      is_budget_account: false,
      sort_order: 9999,
    })
    .select('id')
    .single()

  if (error || !created) {
    return { error: error?.message ?? 'No pudimos crear la cuenta puente' }
  }
  return { id: created.id as string }
}
