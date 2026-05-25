'use server'

// Helpers del flujo de credit-card auto-bucket que tocan la DB.
// La lógica pura sigue en ./ccBucketMath; este módulo es el wrapper
// async que persiste los deltas. Extraído de actions.ts para reducir
// el tamaño del archivo principal y permitir reuso futuro.
//
// YNAB pattern: cuando cargas a una tarjeta de crédito, la categoría
// de gasto se debita Y la categoría "Pago tarjeta de crédito" se
// acredita por el mismo monto. Así, available net se mantiene igual y
// el dinero del pago de la tarjeta se va acumulando solo.

import type { SupabaseClient } from '@supabase/supabase-js'

const CC_PAYMENT_CATEGORY_NAME = 'Pago tarjeta de crédito'

// monthFromDate vive en @/lib/dates — es pura, no necesita ser async.

async function findCreditCardPaymentCategoryId(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('budget_id', budgetId)
    .ilike('name', CC_PAYMENT_CATEGORY_NAME)
    .maybeSingle()
  return data ? (data.id as string) : null
}

/**
 * Aplica `delta` (signed) al monthly_assignment de la categoría
 * "Pago tarjeta de crédito" para el mes dado. Se llama tras crear,
 * actualizar o borrar una transacción en una cuenta credit_card.
 *
 * Silenciosamente no-op cuando:
 *   - No hay payment category en el budget (legacy o user la borró)
 *   - La categoría siendo cargada ES la payment category misma (no
 *     queremos doble-bucketear los pagos internos de la tarjeta)
 */
export async function applyCcBucketDelta(
  supabase: SupabaseClient,
  budgetId: string,
  month: string | null,
  delta: number,
  excludeCategoryId: string | null = null,
) {
  if (!month) return
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) return
  const paymentCatId = await findCreditCardPaymentCategoryId(supabase, budgetId)
  if (!paymentCatId) return
  if (excludeCategoryId && excludeCategoryId === paymentCatId) return

  // Single atomic upsert via assignments_increment RPC (migration
  // 2026_05_04). Replaces el patrón read-then-write que era racey con
  // dos writes concurrentes hacia (category, month).
  await supabase.rpc('assignments_increment', {
    p_budget_id: budgetId,
    p_category_id: paymentCatId,
    p_month: month,
    p_delta: delta,
  })
}
