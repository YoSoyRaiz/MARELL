import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inserta un row en budget_access_log para registrar acceso al
 * budget por un usuario que NO es su propietario.
 *
 * Debounce de 5min: si ya hay un log del mismo (budget, actor,
 * action) en los últimos 5 minutos, no insertamos otro. Esto evita
 * inflar la tabla con cada navegación del auditor mientras revisa
 * el budget — solo nos interesa la "sesión", no cada page hit.
 *
 * Fire-and-forget: si el insert falla (RLS, DB hiccup) no
 * bloqueamos el render. Lo loggeamos para revisión.
 */
const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000

export async function logBudgetAccess(
  supabase: SupabaseClient,
  params: {
    budgetId: string
    action: 'viewed' | 'exported' | 'edited'
  },
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Verifica si el user es owner del budget — los owners NO
    // generan logs (su propia data, no es auditable).
    const { data: budget } = await supabase
      .from('budgets')
      .select('created_by')
      .eq('id', params.budgetId)
      .maybeSingle()
    if (!budget || budget.created_by === user.id) return

    // Debounce: busca log reciente del mismo (budget, actor, action)
    const since = new Date(Date.now() - DEBOUNCE_WINDOW_MS).toISOString()
    const recent = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                gte: (k: string, v: string) => {
                  limit: (n: number) => Promise<{ data: unknown[] | null }>
                }
              }
            }
          }
        }
      }
    })
      .from('budget_access_log')
      .select('id')
      .eq('budget_id', params.budgetId)
      .eq('actor_user_id', user.id)
      .eq('action', params.action)
      .gte('created_at', since)
      .limit(1)
    if (recent.data && recent.data.length > 0) return

    // Insert nuevo log. Cast a never porque tabla es nueva.
    await (supabase as unknown as {
      from: (t: string) => {
        insert: (v: unknown) => Promise<{ error: { message: string } | null }>
      }
    })
      .from('budget_access_log')
      .insert({
        budget_id: params.budgetId,
        actor_user_id: user.id,
        action: params.action,
      })
  } catch (e) {
    console.error('logBudgetAccess error', e)
  }
}
