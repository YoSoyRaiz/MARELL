import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAuditorEnabled } from '@/lib/auth/auditor'
import { NuevoClienteWizard } from './NuevoClienteWizard'

/**
 * Página de creación de cliente nuevo. Gate: profiles.is_auditor=true
 * (administrado desde /admin). Sin permiso, redirigimos a /app.
 */
export default async function NuevoClientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const enabled = await isAuditorEnabled(supabase, user.id, user.email)
  if (!enabled) redirect('/app')

  return <NuevoClienteWizard />
}
