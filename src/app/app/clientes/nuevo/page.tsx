import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NuevoClienteWizard } from './NuevoClienteWizard'

/**
 * Página de creación de cliente nuevo. Solo accesible a usuarios
 * en el allowlist de auditores (env var MARELL_AUDITOR_ALLOWLIST).
 * En Fase 5 esto se reemplaza por un check de plan/tier.
 */
export default async function NuevoClientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Allowlist gate: emails separados por coma en env var.
  // Caso vacío = allowlist desactivado (development/testing). En
  // producción siempre se define la variable.
  const allowlist = (process.env.MARELL_AUDITOR_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length > 0 && !allowlist.includes(user.email?.toLowerCase() ?? '')) {
    redirect('/app')
  }

  return <NuevoClienteWizard />
}
