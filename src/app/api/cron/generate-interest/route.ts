import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInterestForBudget, previousMonthDR } from '@/lib/interest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron mensual: genera txns de intereses estimados sobre cuentas
 * de deuda (credit_card, *_loan, mortgage, *_debt) con APR > 0.
 *
 * Schedule recomendado en vercel.json: '0 6 1 * *' — primer día
 * de cada mes a las 6 AM UTC (2 AM en DR).
 *
 * Idempotente: si ya existe una txn 'Intereses estimados' para
 * esa cuenta en ese mes, hace skip. Esto significa que se puede
 * correr varias veces sin duplicar (útil para retries).
 *
 * Procesa el mes PASADO por defecto (cuando corre el 1 de junio,
 * genera intereses de mayo). El usuario también puede dispararlo
 * manualmente para meses anteriores desde la UI.
 */

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Mes target: query param 'month=YYYY-MM' o mes pasado por default.
  const url = new URL(request.url)
  const monthParam = url.searchParams.get('month')
  const month = monthParam ?? previousMonthDR()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'mes inválido' }, { status: 400 })
  }

  // Iteramos TODOS los budgets activos. Esto es seguro porque la
  // función de generación es idempotente (dedup por payee_name).
  const { data: budgets, error: budgetsErr } = await supabase
    .from('budgets')
    .select('id, name')
  if (budgetsErr) {
    return NextResponse.json({ error: budgetsErr.message }, { status: 500 })
  }

  let totalGenerated = 0
  let totalSkipped = 0
  const perBudget: Array<{ budgetId: string; generated: number; skipped: number }> = []

  for (const b of budgets ?? []) {
    try {
      const r = await generateInterestForBudget(supabase, b.id as string, month)
      totalGenerated += r.generated
      totalSkipped += r.skipped
      perBudget.push({
        budgetId: b.id as string,
        generated: r.generated,
        skipped: r.skipped,
      })
    } catch (e) {
      // No detenemos el cron por un budget que falla — continúa con
      // los demás. Logueamos para inspección posterior.
      console.error(
        'generate-interest: budget',
        b.id,
        e instanceof Error ? e.message : String(e),
      )
      perBudget.push({
        budgetId: b.id as string,
        generated: 0,
        skipped: 0,
      })
    }
  }

  return NextResponse.json({
    month,
    budgetsProcessed: budgets?.length ?? 0,
    totalGenerated,
    totalSkipped,
    perBudget,
  })
}
