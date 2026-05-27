'use server'

import { createClient } from '@/lib/supabase/server'
import {
  convertAmount,
  parseCurrency,
  DEFAULT_USD_TO_DOP_RATE,
} from '@/lib/money'
import { monthBoundsISO } from '@/lib/dates'
import { safeError } from '@/lib/errors'

// Mismo set que /app/analisis/page.tsx — txns sistema (no flujo real).
const SYSTEM_PAYEES = ['Saldo inicial', 'Ajuste de reconciliación']

export interface MonthDetailTxn {
  id: string
  date: string
  payeeName: string | null
  categoryName: string | null
  accountName: string
  /** Monto convertido a DOP (currency del budget). */
  amountDOP: number
  /** Monto crudo en la currency de la cuenta — útil si el ojo del
   *  usuario reconoce mejor "$100 USD" que su conversión a DOP. */
  amountNative: number
  nativeCurrency: 'DOP' | 'USD'
  isTransfer: boolean
}

export interface MonthDetailResult {
  error?: string
  summary?: {
    income: number
    expense: number
    net: number
    txnCount: number
    incomeTxnCount: number
    expenseTxnCount: number
  }
  income?: MonthDetailTxn[]
  expense?: MonthDetailTxn[]
}

/**
 * Devuelve las transacciones del mes (YYYY-MM) ya filtradas igual que
 * los reportes de Análisis: sin transfers, sin saldos iniciales/
 * ajustes de reconciliación, convertidas a DOP del budget.
 *
 * El modal de detalle de Ingresos vs Gastos las muestra agrupadas
 * en dos listas (ingresos / gastos) ordenadas por monto desc para
 * que el usuario vea de inmediato qué transacciones movieron más
 * la aguja.
 */
export async function fetchMonthDetail(
  monthYYYYMM: string,
): Promise<MonthDetailResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYYYYMM)) {
    return { error: 'Mes inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, usd_to_dop_rate')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { error: 'Sin presupuesto' }

  const usdToDopRate =
    (budget as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ??
    DEFAULT_USD_TO_DOP_RATE

  const { first, last } = monthBoundsISO(monthYYYYMM)

  const [txnsRes, accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, payee_name, category_id, account_id, amount, transfer_account_id')
      .eq('budget_id', budget.id)
      .gte('date', first)
      .lte('date', last)
      .is('transfer_account_id', null)
      .order('date', { ascending: false }),
    supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('budget_id', budget.id),
    supabase
      .from('categories')
      .select('id, name')
      .eq('budget_id', budget.id),
  ])

  if (txnsRes.error) return { error: safeError(txnsRes.error, 'analisis') }

  const accountsMap = new Map(
    (accountsRes.data ?? []).map((a) => [
      a.id as string,
      {
        name: a.name as string,
        currency: parseCurrency(a.currency as string | null),
      },
    ]),
  )
  const categoryNameById = new Map(
    (categoriesRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  )

  // Filtra system payees en JS (igual rule que page.tsx) y convierte
  // cada amount a DOP.
  const rows: MonthDetailTxn[] = []
  for (const t of txnsRes.data ?? []) {
    const payee = (t.payee_name as string | null) ?? null
    if (payee && SYSTEM_PAYEES.includes(payee)) continue
    const acct = accountsMap.get(t.account_id as string)
    const nativeCcy = acct?.currency ?? 'DOP'
    const native = Number(t.amount)
    const dop = convertAmount(native, nativeCcy, 'DOP', usdToDopRate)
    rows.push({
      id: t.id as string,
      date: t.date as string,
      payeeName: payee,
      categoryName: t.category_id
        ? categoryNameById.get(t.category_id as string) ?? null
        : null,
      accountName: acct?.name ?? '—',
      amountDOP: dop,
      amountNative: native,
      nativeCurrency: nativeCcy,
      isTransfer: false,
    })
  }

  const income = rows
    .filter((r) => r.amountDOP > 0.005)
    .sort((a, b) => b.amountDOP - a.amountDOP)
  const expense = rows
    .filter((r) => r.amountDOP < -0.005)
    .sort((a, b) => a.amountDOP - b.amountDOP) // más negativo primero

  const totalIncome = income.reduce((s, r) => s + r.amountDOP, 0)
  const totalExpense = expense.reduce((s, r) => s + Math.abs(r.amountDOP), 0)

  return {
    summary: {
      income: Math.round(totalIncome * 100) / 100,
      expense: Math.round(totalExpense * 100) / 100,
      net: Math.round((totalIncome - totalExpense) * 100) / 100,
      txnCount: rows.length,
      incomeTxnCount: income.length,
      expenseTxnCount: expense.length,
    },
    income,
    expense,
  }
}
