import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper para chequear si un usuario tiene permiso de Auditor Financiero.
 *
 * Fuente de verdad: columna `profiles.is_auditor` (migration
 * 2026_06_02_auditor_permission.sql). El admin la togglea desde
 * `/admin`. Revocación = pausa: las agency_relationships quedan
 * intactas, solo se bloquea el acceso al feature.
 */
export async function isAuditorEnabled(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_auditor')
    .eq('id', userId)
    .maybeSingle()
  return data?.is_auditor === true
}
