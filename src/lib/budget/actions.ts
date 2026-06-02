'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAuditorEnabled } from '@/lib/auth/auditor'
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
    .select('id, created_by')
    .eq('id', budgetId)
    .maybeSingle()
  if (!budget) return { error: 'Sin acceso a ese presupuesto' }

  // Hardening de revocación: si el budget viene por una relación de
  // auditoría (no familia, no propio), validamos is_auditor=true. Los
  // budgets compartidos por familia (rol editor/viewer en
  // budget_members sin agency_relationships) NO requieren este check.
  // Tabla agency_relationships → cast a unknown (types no la conocen).
  if (budget.created_by && budget.created_by !== user.id) {
    const arLookup = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: string) => {
                  maybeSingle: () => Promise<{ data: { id: string } | null }>
                }
              }
            }
          }
        }
      }
    )
      .from('agency_relationships')
      .select('id')
      .eq('auditor_user_id', user.id)
      .eq('client_budget_id', budgetId)
      .eq('status', 'active')
      .maybeSingle()

    if (arLookup.data) {
      // Es un budget de cliente → requiere permiso activo.
      const enabled = await isAuditorEnabled(supabase, user.id, user.email ?? null)
      if (!enabled) {
        return { error: 'Sin acceso a ese presupuesto' }
      }
    }
  }

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
