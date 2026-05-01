import { createClient } from '@/lib/supabase/server'
import { requirePro, type PlanState } from './plan-gate'

/**
 * Server-side helper that loads the current user's plan state and
 * returns either { ok: true } (continue) or { error } (return early).
 *
 * Use this at the top of any server action that should be gated to
 * Pro. While `BILLING_ENFORCEMENT_ENABLED` is off the helper always
 * returns ok, so we can ship the dark-launch flow now.
 *
 * Returns the loaded `PlanState` alongside `ok` so callers that
 * already need the user can skip a second auth lookup.
 */
export async function ensurePro(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, trial_ends_at, pro_expires_at, subscription_status')
    .eq('id', user.id)
    .single()

  const state: PlanState = {
    plan: (profile?.plan as string | null) ?? null,
    trialEndsAt: (profile?.trial_ends_at as string | null) ?? null,
    proExpiresAt: (profile?.pro_expires_at as string | null) ?? null,
    subscriptionStatus:
      ((profile as { subscription_status?: string | null } | null)
        ?.subscription_status as string | null) ?? null,
  }
  const r = requirePro(state)
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, userId: user.id }
}
