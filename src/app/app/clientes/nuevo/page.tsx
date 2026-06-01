import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isInAuditorAllowlist } from '@/lib/auth/auditor'
import { NuevoClienteWizard } from './NuevoClienteWizard'

/**
 * Página de creación de cliente nuevo. Solo accesible a usuarios
 * en el allowlist de auditores (env var MARELL_AUDITOR_ALLOWLIST).
 * Cuando se implemente el tier "Asesor" de pricing, este check
 * se reemplaza por un check de plan.
 */
export default async function NuevoClientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!isInAuditorAllowlist(user.email)) {
    redirect('/app')
  }

  return <NuevoClienteWizard />
}
