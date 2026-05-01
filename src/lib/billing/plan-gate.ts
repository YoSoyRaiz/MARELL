// Plan enforcement helpers. Call these from server actions or page
// loaders to gate Pro features. The gate honors a feature flag
// (`BILLING_ENFORCEMENT_ENABLED`) so we can ship the upgrade flow
// dark — once the founder is ready to actually start charging, flip
// the env var and gates start blocking.

export type AccessLevel = 'pro' | 'trial' | 'free'

export interface PlanState {
  plan: string | null
  trialEndsAt: string | null
  proExpiresAt: string | null
  subscriptionStatus: string | null
}

/**
 * Resolve the user's effective access level. Trial overrides every
 * other state until it ends. After that, the user is "pro" only if
 * their subscription is active AND not past its expiration.
 */
export function resolveAccess(state: PlanState): AccessLevel {
  const now = Date.now()
  if (state.plan === 'pro' && state.subscriptionStatus === 'active') {
    if (state.proExpiresAt) {
      const exp = new Date(state.proExpiresAt).getTime()
      if (Number.isFinite(exp) && exp > now) return 'pro'
      // expired — fall through to free
    } else {
      return 'pro'
    }
  }
  if (state.trialEndsAt) {
    const t = new Date(state.trialEndsAt).getTime()
    if (Number.isFinite(t) && t > now) return 'trial'
  }
  return 'free'
}

export function isEnforcementEnabled(): boolean {
  // Flip to '1' / 'true' in the Vercel env vars when ready to charge.
  const v = process.env.BILLING_ENFORCEMENT_ENABLED
  return v === '1' || v === 'true'
}

/**
 * The single chokepoint server actions call before doing anything
 * that requires Pro. Returns null when access is granted, or a user-
 * facing error string when blocked. Centralizing it means we can
 * tweak which features count as "pro-only" in one place.
 */
export function requirePro(state: PlanState):
  | { ok: true }
  | { ok: false; error: string; reason: 'free' | 'expired' | 'past_due' } {
  if (!isEnforcementEnabled()) return { ok: true }
  const access = resolveAccess(state)
  if (access === 'pro' || access === 'trial') return { ok: true }
  if (state.subscriptionStatus === 'past_due') {
    return {
      ok: false,
      reason: 'past_due',
      error: 'Tu suscripción está al día pero el pago de este mes falló. Actualiza tu método de pago.',
    }
  }
  if (state.proExpiresAt) {
    return {
      ok: false,
      reason: 'expired',
      error: 'Tu suscripción Pro venció. Renueva para seguir usando esta función.',
    }
  }
  return {
    ok: false,
    reason: 'free',
    error: 'Esta función está disponible en Pro. Activa Pro para continuar.',
  }
}

/**
 * Some Pro features have a softer gate: trial users get them, but
 * post-trial free users see them as locked-with-CTA in the UI rather
 * than 401-blocked at the server. Use this in components to render
 * the lock state.
 */
export function isLocked(state: PlanState): boolean {
  if (!isEnforcementEnabled()) return false
  return resolveAccess(state) === 'free'
}
