'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { writeActiveBudgetCookie } from './active'

/**
 * Server Action: cambiar el budget activo del usuario.
 *
 * Valida que el usuario tenga acceso al budget (RLS ya bloquea
 * reads, pero validamos explícito antes de setear cookie para que
 * un error sea legible en vez de fallar silenciosamente en queries
 * posteriores).
 *
 * Revalida `/app` layout para que el próximo render lea la cookie
 * nueva y cargue el budget correcto.
 */
export async function setActiveBudget(budgetId: string): Promise<
  { success: true } | { error: string }
> {
  if (!budgetId) return { error: 'budgetId requerido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Membership check — solo permitimos setear un budget al que el
  // usuario realmente tiene acceso. RLS bloquea reads pero esto
  // evita confusión de "cambié de budget pero todo está vacío".
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', budgetId)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso a ese presupuesto' }

  await writeActiveBudgetCookie(budgetId)
  revalidatePath('/app', 'layout')
  return { success: true }
}
