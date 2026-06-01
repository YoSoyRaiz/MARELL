import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Active budget resolver.
 *
 * Antes MARELL asumía "1 budget por usuario" — todas las queries
 * hacían `.limit(1).order('created_at')`. Para soportar el caso
 * "auditor con N clientes" + "usuario con presupuestos personales y
 * compartidos", introducimos un "active budget" persistente.
 *
 * Fuente de verdad: cookie httpOnly `marell_active_budget`.
 * Override opcional vía query param `?budget=<id>` (útil para
 * deep-links del auditor abriendo cliente X sin cambiar la cookie
 * y romper otras tabs).
 *
 * Fallback: si no hay cookie/param, toma el primer budget del usuario
 * por created_at ASC. Esto **preserva el comportamiento previo** para
 * usuarios single-budget que nunca tocaron el switcher.
 *
 * Validación de membership: si la cookie apunta a un budget al que
 * el usuario ya no tiene acceso (revocado, eliminado), fallback al
 * primero. Defense in depth — RLS ya bloquea las queries, pero esto
 * evita errors confusos.
 */

const COOKIE_NAME = 'marell_active_budget'
// Cookie de 1 año — la elección de budget es persistente por
// navegador. Si el usuario quiere "olvidar" su elección, limpiar
// cookies. Más conservador que session cookie porque el switcher
// debe sobrevivir refresh + close-reopen.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Helper para leer el active budget del usuario actual.
 *
 * @param supabase Cliente Supabase autenticado (server-side)
 * @param queryBudgetOverride Opcional — id del budget si viene en
 *   ?budget=… del URL. Si se pasa y es válido, gana sobre la cookie.
 *
 * @returns `{ budgetId, source }` donde source dice de dónde vino
 *   ('query' | 'cookie' | 'fallback' | null si el usuario no tiene
 *   ningún budget).
 */
export async function getActiveBudgetId(
  supabase: SupabaseClient,
  queryBudgetOverride?: string | null,
): Promise<{ budgetId: string | null; source: 'query' | 'cookie' | 'fallback' | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { budgetId: null, source: null }

  // Helper: valida que el usuario tenga acceso al budget vía
  // budget_members o sea su owner. Una sola query.
  const validate = async (candidateId: string): Promise<boolean> => {
    if (!isValidUUID(candidateId)) return false
    const { data } = await supabase
      .from('budgets')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle()
    return !!data
  }

  // 1. Query override gana primero (deep-link del auditor)
  if (queryBudgetOverride && (await validate(queryBudgetOverride))) {
    return { budgetId: queryBudgetOverride, source: 'query' }
  }

  // 2. Cookie persistida
  const cookieStore = await cookies()
  const stored = cookieStore.get(COOKIE_NAME)?.value
  if (stored && (await validate(stored))) {
    return { budgetId: stored, source: 'cookie' }
  }

  // 3. Fallback al primer budget del usuario — preserva comportamiento
  // single-budget previo.
  const { data: first } = await supabase
    .from('budgets')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!first) return { budgetId: null, source: null }
  return { budgetId: first.id as string, source: 'fallback' }
}

/**
 * Lee la cookie cruda sin validar — útil cuando ya tienes el budget
 * cargado y solo quieres saber si la fuente fue cookie. NO usar para
 * acceso a data.
 */
export async function readActiveBudgetCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

/**
 * Setea la cookie. Solo Server Actions / Route Handlers — Next no
 * permite mutar cookies en RSC normales. Validar membership ANTES de
 * llamar esta función (no lo hace internamente).
 */
export async function writeActiveBudgetCookie(budgetId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, budgetId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

/**
 * Limpia la cookie. Útil en logout y cuando el budget fue eliminado.
 */
export async function clearActiveBudgetCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// UUIDv4-ish. Suficiente para evitar SQL inyección literal del query
// param (la validación real la hace RLS).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(s: string): boolean {
  return UUID_RE.test(s)
}

/**
 * Devuelve la lista completa de budgets a los que el usuario actual
 * tiene acceso: los propios (created_by = user) + los compartidos
 * (vía budget_members). Cada uno con el rol del usuario en ese
 * budget (owner | editor | viewer | auditor).
 *
 * Útil para el BudgetSwitcher en TopBar y para el dashboard "Mis
 * Clientes" del auditor.
 */
export interface UserBudgetListItem {
  id: string
  name: string
  currency: 'DOP' | 'USD' | string | null
  role: 'owner' | 'editor' | 'viewer' | 'auditor'
  isOwn: boolean
}

export async function listUserBudgets(
  supabase: SupabaseClient,
): Promise<UserBudgetListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // RLS ya devuelve solo los budgets accesibles (propios + miembros).
  // Hacemos la query de budgets + membership en paralelo y joineamos
  // en JS para evitar dependencia de la sintaxis de Supabase joins.
  const [budgetsRes, membersRes] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, name, currency, created_by')
      .order('created_at', { ascending: true }),
    supabase
      .from('budget_members')
      .select('budget_id, role')
      .eq('user_id', user.id),
  ])

  const memberRoles = new Map<string, string>()
  for (const m of membersRes.data ?? []) {
    memberRoles.set(m.budget_id as string, m.role as string)
  }

  const items: UserBudgetListItem[] = []
  for (const b of budgetsRes.data ?? []) {
    const isOwn = b.created_by === user.id
    // Rol final: si es owner del row, role='owner'. Si no, lee de
    // budget_members. Fallback a 'viewer' si por algún motivo no
    // hay membership (no debería pasar — RLS lo bloquearía).
    const role = isOwn
      ? 'owner'
      : ((memberRoles.get(b.id as string) ?? 'viewer') as
          | 'owner'
          | 'editor'
          | 'viewer'
          | 'auditor')
    items.push({
      id: b.id as string,
      name: b.name as string,
      currency: b.currency as string | null,
      role,
      isOwn,
    })
  }
  return items
}
