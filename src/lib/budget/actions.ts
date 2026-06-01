'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

/**
 * Vuelve al primer budget propio del usuario (created_by = user.id).
 * Usado por el botón "Volver a mi cuenta" del banner cuando el
 * auditor está viendo data de un cliente. Si el usuario no tiene
 * budgets propios, deja la cookie como está (no le robamos contexto).
 *
 * Redirect a /app después de setear — un solo round-trip.
 */
export async function setActiveBudgetToOwn(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ownBudget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownBudget) {
    await writeActiveBudgetCookie(ownBudget.id as string)
  }
  revalidatePath('/app', 'layout')
  redirect('/app')
}
