'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  convertAmount,
  parseCurrency,
  DEFAULT_USD_TO_DOP_RATE,
  type Currency,
} from '@/lib/money'
import { currentMonthDR, monthBoundsISO } from '@/lib/dates'

/**
 * Server Action: lista todos los clientes del auditor con KPIs
 * computados (patrimonio, ingresos mes, gastos mes, # alertas).
 *
 * Diseñado para escalar a N grande:
 *   - Una sola query para agency_relationships (indexada por
 *     auditor_user_id WHERE status='active')
 *   - KPIs se computan client por cliente con queries paralelas
 *     (cada cliente cabe en ~5 queries). Para N=100 son ~500
 *     round-trips — acceptable. P2: vista materializada.
 *   - Admin client necesario porque queremos saltarnos RLS para
 *     atajar — RLS funcionaría pero requeriría que el auditor ya
 *     tenga la cookie del budget del cliente, que es ridículo.
 *
 * Sin paginación en V1 — agregar cuando N > 50 cause problemas
 * reales en producción.
 */

const SYSTEM_PAYEES = ['Saldo inicial', 'Ajuste de reconciliación']
const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const DEBT_TYPES = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

export interface ClientDashboardRow {
  agencyRelationshipId: string
  clientUserId: string
  clientBudgetId: string
  clientLabel: string
  status: 'active' | 'paused' | 'ended'
  createdAt: string
  // KPIs en DOP siempre (convertidos desde currency nativa del budget)
  netWorthDOP: number
  monthIncomeDOP: number
  monthExpenseDOP: number
  alertCount: number
}

export interface ClientDashboardResult {
  error?: string
  rows?: ClientDashboardRow[]
  /** Totales agregados — útil para el header del dashboard. */
  totals?: {
    clientCount: number
    netWorthSumDOP: number
    monthIncomeSumDOP: number
    monthExpenseSumDOP: number
    alertSum: number
  }
}

export async function fetchClientsDashboard(): Promise<ClientDashboardResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = createAdminClient()

  // 1. Trae las relaciones activas del auditor
  // Cast a unknown porque agency_relationships es tabla nueva y los
  // types generados no la conocen aún.
  const relsRes = await (admin as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          eq: (
            k: string,
            v: string,
          ) => {
            order: (
              k: string,
              o: { ascending: boolean },
            ) => Promise<{
              data:
                | {
                    id: string
                    client_user_id: string
                    client_budget_id: string
                    client_label: string | null
                    status: 'active' | 'paused' | 'ended'
                    created_at: string
                  }[]
                | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  })
    .from('agency_relationships')
    .select('id, client_user_id, client_budget_id, client_label, status, created_at')
    .eq('auditor_user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (relsRes.error) return { error: relsRes.error.message }
  const rels = relsRes.data ?? []
  if (rels.length === 0) {
    return {
      rows: [],
      totals: {
        clientCount: 0,
        netWorthSumDOP: 0,
        monthIncomeSumDOP: 0,
        monthExpenseSumDOP: 0,
        alertSum: 0,
      },
    }
  }

  const budgetIds = rels.map((r) => r.client_budget_id)
  const month = currentMonthDR()
  const { first, last } = monthBoundsISO(month)
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // 2. Trae budgets (currency + fx rate) en una sola query
  const { data: budgets } = await admin
    .from('budgets')
    .select('id, currency, usd_to_dop_rate')
    .in('id', budgetIds)
  const budgetMeta = new Map<
    string,
    { currency: Currency; rate: number }
  >()
  for (const b of budgets ?? []) {
    budgetMeta.set(b.id as string, {
      currency: parseCurrency(b.currency as string | null),
      rate:
        ((b as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ??
          DEFAULT_USD_TO_DOP_RATE) as number,
    })
  }

  // 3. Trae accounts + balances (necesitamos currency por cuenta)
  const { data: accounts } = await admin
    .from('accounts')
    .select('id, budget_id, type, balance, currency, closed')
    .in('budget_id', budgetIds)
    .eq('closed', false)

  // 4. Trae transacciones del mes para cada budget. Una sola query
  // con IN y filtros server-side.
  const { data: monthTxns } = await admin
    .from('transactions')
    .select('budget_id, account_id, amount, transfer_account_id, payee_name')
    .in('budget_id', budgetIds)
    .gte('date', first)
    .lte('date', last <= today ? last : today)

  // Mapas para lookup
  const accountCurrencyById = new Map<string, Currency>()
  const accountBudgetById = new Map<string, string>()
  for (const a of accounts ?? []) {
    accountCurrencyById.set(
      a.id as string,
      parseCurrency(a.currency as string | null),
    )
    accountBudgetById.set(a.id as string, a.budget_id as string)
  }

  // 5. Agrega KPIs por budget
  const kpiByBudget = new Map<
    string,
    { netWorthDOP: number; monthIncomeDOP: number; monthExpenseDOP: number; alertCount: number }
  >()
  for (const id of budgetIds) {
    kpiByBudget.set(id, { netWorthDOP: 0, monthIncomeDOP: 0, monthExpenseDOP: 0, alertCount: 0 })
  }

  // Net worth — balance signed-aware. La cuenta clearing/puente se
  // excluye porque representa transferencias en tránsito que no son
  // patrimonio real (debería estar en 0; si no lo está, es un signal
  // de transferencia pendiente, no patrimonio que el cliente tenga).
  for (const a of accounts ?? []) {
    const budgetId = a.budget_id as string
    const kpi = kpiByBudget.get(budgetId)
    if (!kpi) continue
    const type = a.type as string
    if (type === 'clearing') continue
    const ccy = parseCurrency(a.currency as string | null)
    const meta = budgetMeta.get(budgetId)
    const rate = meta?.rate ?? DEFAULT_USD_TO_DOP_RATE
    const balanceDOP = convertAmount(Number(a.balance), ccy, 'DOP', rate)
    if (DEBT_TYPES.has(type)) {
      kpi.netWorthDOP -= Math.abs(balanceDOP)
    } else if (type === 'liability') {
      kpi.netWorthDOP -= balanceDOP
    } else {
      kpi.netWorthDOP += balanceDOP
    }
  }

  // Income / expense del mes — filtra system payees + transfers
  for (const t of monthTxns ?? []) {
    if (t.transfer_account_id) continue
    const payee = (t.payee_name as string | null) ?? null
    if (payee && SYSTEM_PAYEES.includes(payee)) continue
    const budgetId = t.budget_id as string
    const kpi = kpiByBudget.get(budgetId)
    if (!kpi) continue
    const ccy = accountCurrencyById.get(t.account_id as string) ?? 'DOP'
    const meta = budgetMeta.get(budgetId)
    const rate = meta?.rate ?? DEFAULT_USD_TO_DOP_RATE
    const amount = convertAmount(Number(t.amount), ccy, 'DOP', rate)
    if (amount > 0) kpi.monthIncomeDOP += amount
    else if (amount < 0) kpi.monthExpenseDOP += Math.abs(amount)
  }

  // Alertas básicas en V1: net worth negativo (deudas > activos)
  // o gastos del mes > ingresos del mes. Más sofisticación en V2.
  for (const id of budgetIds) {
    const kpi = kpiByBudget.get(id)!
    let alerts = 0
    if (kpi.netWorthDOP < 0) alerts++
    if (kpi.monthExpenseDOP > kpi.monthIncomeDOP && kpi.monthIncomeDOP > 0) alerts++
    kpi.alertCount = alerts
  }

  // 6. Construye los rows + totales
  const rows: ClientDashboardRow[] = rels.map((r) => {
    const kpi = kpiByBudget.get(r.client_budget_id)!
    return {
      agencyRelationshipId: r.id,
      clientUserId: r.client_user_id,
      clientBudgetId: r.client_budget_id,
      clientLabel: r.client_label ?? 'Cliente sin nombre',
      status: r.status,
      createdAt: r.created_at,
      netWorthDOP: Math.round(kpi.netWorthDOP * 100) / 100,
      monthIncomeDOP: Math.round(kpi.monthIncomeDOP * 100) / 100,
      monthExpenseDOP: Math.round(kpi.monthExpenseDOP * 100) / 100,
      alertCount: kpi.alertCount,
    }
  })

  const totals = {
    clientCount: rows.length,
    netWorthSumDOP: rows.reduce((s, r) => s + r.netWorthDOP, 0),
    monthIncomeSumDOP: rows.reduce((s, r) => s + r.monthIncomeDOP, 0),
    monthExpenseSumDOP: rows.reduce((s, r) => s + r.monthExpenseDOP, 0),
    alertSum: rows.reduce((s, r) => s + r.alertCount, 0),
  }

  return { rows, totals }
}
