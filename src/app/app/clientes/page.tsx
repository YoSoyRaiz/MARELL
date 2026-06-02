import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAuditorEnabled } from '@/lib/auth/auditor'
import { ClientesClient } from './ClientesClient'
import { fetchClientsDashboard } from './dashboard-action'

/**
 * Dashboard "Mis Clientes" — vista del auditor.
 *
 * Gate: profiles.is_auditor=true (controlado desde /admin). Sin permiso
 * activo, redirigimos a /app. Revocación = pausa: las relaciones
 * quedan intactas pero el acceso se bloquea hasta que el admin
 * reactive.
 */
export default async function ClientesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const enabled = await isAuditorEnabled(supabase, user.id, user.email)
  if (!enabled) redirect('/app')

  const result = await fetchClientsDashboard()
  if (result.error) {
    return (
      <ClientesClient rows={[]} totals={emptyTotals()} canCreate={true} />
    )
  }

  return (
    <ClientesClient
      rows={result.rows ?? []}
      totals={result.totals ?? emptyTotals()}
      canCreate={true}
    />
  )
}

function emptyTotals() {
  return {
    clientCount: 0,
    netWorthSumDOP: 0,
    monthIncomeSumDOP: 0,
    monthExpenseSumDOP: 0,
    alertSum: 0,
  }
}
