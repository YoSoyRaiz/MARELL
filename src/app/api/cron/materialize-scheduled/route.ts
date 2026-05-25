import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cron diario para materializar transacciones programadas. Antes esto
// vivía en el hot-path de /app (Resumen): cada page-load del dashboard
// disparaba `materializeDue()`, que escaneaba scheduled_transactions y
// hacía INSERTs. (Auditoría calidad L2.)
//
// Ahora corre 1× al día para todos los budgets activos. La RPC
// `materialize_due_scheduled` es atómica por budget — si un budget
// falla, los otros siguen.

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Filtramos a budgets con scheduled_transactions activos y due.
  // En vez de iterar todos los budgets ciegamente, pedimos la lista
  // de budget_ids únicos que tienen al menos un programado vencido.
  // Esto evita N RPCs vacíos para usuarios sin programados.
  const today = new Date(Date.now() - 4 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: dueRows, error: dueErr } = await supabase
    .from('scheduled_transactions')
    .select('budget_id')
    .eq('active', true)
    .lte('next_date', today)

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }

  const budgetIds = Array.from(
    new Set((dueRows ?? []).map((r) => r.budget_id as string)),
  )

  let totalCreated = 0
  const errors: string[] = []

  for (const budgetId of budgetIds) {
    const { data, error } = await supabase.rpc('materialize_due_scheduled', {
      p_budget_id: budgetId,
    })
    if (error) {
      errors.push(`${budgetId}: ${error.message}`)
      continue
    }
    totalCreated += typeof data === 'number' ? data : 0
  }

  return NextResponse.json({
    ok: true,
    budgetsScanned: budgetIds.length,
    transactionsCreated: totalCreated,
    errors: errors.length > 0 ? errors : undefined,
  })
}
