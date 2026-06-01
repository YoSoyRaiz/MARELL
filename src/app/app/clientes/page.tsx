import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientesClient } from './ClientesClient'
import { fetchClientsDashboard } from './dashboard-action'

/**
 * Dashboard "Mis Clientes" — vista del auditor.
 *
 * Accesibilidad: cualquier usuario que tenga al menos una row activa
 * en agency_relationships como auditor ve esta página. No es un
 * "rol de cuenta" — es derivado del estado.
 *
 * Allowlist gate solo para CREAR clientes (esa ruta es la que
 * realmente importa controlar). Listar lo que ya tienes es siempre
 * accesible.
 */
export default async function ClientesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await fetchClientsDashboard()
  if (result.error) {
    // No bloqueamos render — mostramos estado vacío con error chip
    return (
      <ClientesClient rows={[]} totals={emptyTotals()} canCreate={false} />
    )
  }

  // Allowlist para botón "Crear cliente"
  const allowlist = (process.env.MARELL_AUDITOR_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const canCreate =
    allowlist.length === 0 || allowlist.includes(user.email?.toLowerCase() ?? '')

  return (
    <ClientesClient
      rows={result.rows ?? []}
      totals={result.totals ?? emptyTotals()}
      canCreate={canCreate}
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
