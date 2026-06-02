import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper para chequear si un usuario tiene permiso de Auditor Financiero.
 *
 * Fuente de verdad: columna `profiles.is_auditor` (migration
 * 2026_06_02_auditor_permission.sql). El admin la togglea desde
 * `/admin`. Revocación = pausa: las agency_relationships quedan
 * intactas, solo se bloquea el acceso al feature.
 *
 * Fallback temporal: si el flag de DB está en false pero el email
 * sigue en `MARELL_AUDITOR_ALLOWLIST`, devolvemos true. Esto evita
 * cortar acceso a usuarios actualmente allowlisted mientras seedamos
 * profiles.is_auditor. Remover la env var + esta rama después de la
 * migración completa.
 *
 * @deprecated MARELL_AUDITOR_ALLOWLIST — usar admin panel para gestionar
 * permisos. La env var se mantiene como fallback transicional.
 */
export async function isAuditorEnabled(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  // Fuente principal: DB.
  const { data } = await supabase
    .from('profiles')
    .select('is_auditor')
    .eq('id', userId)
    .maybeSingle()
  if (data?.is_auditor === true) return true

  // Fallback transicional: env var allowlist.
  return isInAuditorAllowlistEnv(email)
}

/**
 * Lee el allowlist legacy de la env var. Solo lo usa `isAuditorEnabled`
 * como fallback; las páginas no deberían llamarlo directamente.
 *
 * @deprecated Removerse cuando todos los allowlisted estén seedados en
 * profiles.is_auditor.
 */
function isInAuditorAllowlistEnv(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.MARELL_AUDITOR_ALLOWLIST ?? ''
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (list.length === 0) return false
  return list.includes(email.toLowerCase())
}
