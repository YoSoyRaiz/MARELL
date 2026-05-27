'use server'

import { createClient } from '@/lib/supabase/server'
import {
  convertAmount,
  parseCurrency,
  DEFAULT_USD_TO_DOP_RATE,
  type Currency,
} from '@/lib/money'
import { expandToCategoryContributions } from '@/lib/splits'
import { monthBoundsISO, MONTH_NAMES_SHORT, MONTH_NAMES_FULL } from '@/lib/dates'
import { safeError } from '@/lib/errors'

// Mismo set que /app/analisis/page.tsx — txns sistema (no flujo real).
const SYSTEM_PAYEES = ['Saldo inicial', 'Ajuste de reconciliación']
const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const DEBT_TYPES_SET = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

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

// ── Bulk export ─────────────────────────────────────────────────
//
// Fetcha la data agregada de los 5 reportes para exportar (PDF/CSV).
// Una sola server action en vez de 5 separadas: minimiza round-trips
// y permite que el cliente arme el archivo de una sola vez.
//
// Rangos: usamos defaults sensatos (last 12 meses para series, mes
// actual para breakdown) en vez de leer los rangos seleccionados por
// el usuario porque el export es un snapshot estándar — el auditor
// espera ver un período completo, no lo que el usuario tenía abierto.

export interface ExportPayload {
  error?: string
  generatedAt: string
  budgetCurrency: 'DOP' | 'USD'
  usdToDopRate: number
  reports?: {
    breakdown: {
      periodLabel: string
      totalIncome: number
      totalExpenses: number
      uncategorized: number
      categories: { name: string; amount: number }[]
    }
    incomeVsExpense: {
      rangeLabel: string
      months: { month: string; label: string; income: number; expense: number; net: number }[]
      totalIncome: number
      totalExpense: number
    }
    trends: {
      rangeLabel: string
      months: { month: string; label: string }[]
      categories: { name: string; total: number; values: number[] }[]
    }
    netWorth: {
      rangeLabel: string
      series: { month: string; label: string; value: number }[]
      totalCash: number
      totalAssets: number
      totalDebts: number
      currentNetWorth: number
    }
    ageOfMoney: {
      rangeLabel: string
      series: { month: string; label: string; ageDays: number | null }[]
    }
  }
}

const todayLocalDate = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const formatISODateLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function fetchExportData(): Promise<ExportPayload> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', generatedAt: '', budgetCurrency: 'DOP', usdToDopRate: 0 }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, currency, usd_to_dop_rate')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) {
    return { error: 'Sin presupuesto', generatedAt: '', budgetCurrency: 'DOP', usdToDopRate: 0 }
  }

  const budgetCurrency = parseCurrency(budget.currency as string | null)
  const usdToDopRate =
    (budget as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ??
    DEFAULT_USD_TO_DOP_RATE

  // Last-12-months window para series. Mes actual para breakdown.
  const today = todayLocalDate()
  const todayISO = formatISODateLocal(today)
  const monthCount = 12
  const seriesFirst = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1), 1)
  const seriesFirstISO = formatISODateLocal(seriesFirst)
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const { first: breakdownFirst, last: breakdownLast } = monthBoundsISO(currentMonth)
  const breakdownLastCap = breakdownLast > todayISO ? todayISO : breakdownLast

  // Fetch shared data (accounts + currencies) y los txns por rango.
  const [accountsRes, categoriesRes, breakdownTxnsRes, seriesTxnsRes, nwAccountsRes, nwTxnsRes, aomTxnsRes] = await Promise.all([
    supabase.from('accounts').select('id, name, currency, type, balance').eq('budget_id', budget.id),
    supabase.from('categories').select('id, name').eq('budget_id', budget.id),
    // Breakdown: txns del mes actual
    supabase
      .from('transactions')
      .select('id, date, account_id, category_id, amount, is_split, subtransactions(category_id, amount)')
      .eq('budget_id', budget.id)
      .is('transfer_account_id', null)
      .not('payee_name', 'in', `("${SYSTEM_PAYEES.join('","')}")`)
      .gte('date', breakdownFirst)
      .lte('date', breakdownLastCap),
    // Series (income/expense + trends): txns últimos 12 meses
    supabase
      .from('transactions')
      .select('id, date, account_id, category_id, amount, is_split, subtransactions(category_id, amount)')
      .eq('budget_id', budget.id)
      .is('transfer_account_id', null)
      .not('payee_name', 'in', `("${SYSTEM_PAYEES.join('","')}")`)
      .gte('date', seriesFirstISO)
      .lte('date', todayISO),
    // Net worth: accounts (con currency/type) + TODA la data de txns
    supabase.from('accounts').select('id, type, balance, currency').eq('budget_id', budget.id),
    supabase
      .from('transactions')
      .select('date, account_id, amount')
      .eq('budget_id', budget.id),
    // Age of money: full history
    supabase
      .from('transactions')
      .select('date, account_id, amount')
      .eq('budget_id', budget.id)
      .is('transfer_account_id', null)
      .not('payee_name', 'in', `("${SYSTEM_PAYEES.join('","')}")`)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
  ])

  if (accountsRes.error) return { error: safeError(accountsRes.error, 'analisis'), generatedAt: '', budgetCurrency, usdToDopRate }

  const accountCurrency = new Map<string, Currency>()
  for (const a of accountsRes.data ?? []) {
    accountCurrency.set(a.id as string, parseCurrency(a.currency as string | null))
  }
  const toDOP = (amount: number, accountId: string) => {
    const ccy = accountCurrency.get(accountId) ?? 'DOP'
    return convertAmount(amount, ccy, 'DOP', usdToDopRate)
  }
  const categoryNameById = new Map(
    (categoriesRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  )

  // ── Report 1: Breakdown ─────────────────────────────────────
  const breakdownTxns = breakdownTxnsRes.data ?? []
  let bdIncome = 0
  let bdExpense = 0
  for (const t of breakdownTxns) {
    const amt = toDOP(Number(t.amount), t.account_id as string)
    if (amt > 0) bdIncome += amt
    else if (amt < 0) bdExpense += Math.abs(amt)
  }
  const expensesByCat = new Map<string, number>()
  let uncategorized = 0
  for (const c of expandToCategoryContributions(breakdownTxns)) {
    if (c.amount >= 0) continue
    const abs = Math.abs(toDOP(c.amount, c.account_id))
    const catId = c.category_id
    if (catId && categoryNameById.has(catId)) {
      expensesByCat.set(catId, (expensesByCat.get(catId) ?? 0) + abs)
    } else {
      uncategorized += abs
    }
  }
  const breakdownCategories = Array.from(expensesByCat.entries())
    .map(([id, amount]) => ({
      name: categoryNameById.get(id) ?? '—',
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount)

  // ── Report 2: Income vs Expense (12 meses) ──────────────────
  const seriesTxns = seriesTxnsRes.data ?? []
  const byMonth = new Map<string, { income: number; expense: number }>()
  for (const t of seriesTxns) {
    const m = (t.date as string).slice(0, 7)
    const amt = toDOP(Number(t.amount), t.account_id as string)
    const cur = byMonth.get(m) ?? { income: 0, expense: 0 }
    if (amt > 0) cur.income += amt
    else if (amt < 0) cur.expense += Math.abs(amt)
    byMonth.set(m, cur)
  }
  const monthsList: { month: string; label: string; income: number; expense: number; net: number }[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const agg = byMonth.get(key) ?? { income: 0, expense: 0 }
    const income = Math.round(agg.income * 100) / 100
    const expense = Math.round(agg.expense * 100) / 100
    monthsList.push({
      month: key,
      label: `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      income,
      expense,
      net: Math.round((income - expense) * 100) / 100,
    })
  }
  const totalIE = monthsList.reduce(
    (s, m) => ({ income: s.income + m.income, expense: s.expense + m.expense }),
    { income: 0, expense: 0 },
  )

  // ── Report 3: Trends (top 5 categorías) ─────────────────────
  const totalsByCat = new Map<string, Map<string, number>>()
  const overallByCat = new Map<string, number>()
  for (const c of expandToCategoryContributions(seriesTxns)) {
    if (c.amount >= 0) continue
    const catId = c.category_id
    if (!catId || !categoryNameById.has(catId)) continue
    const month = c.date.slice(0, 7)
    const abs = Math.abs(toDOP(c.amount, c.account_id))
    let mp = totalsByCat.get(catId)
    if (!mp) {
      mp = new Map<string, number>()
      totalsByCat.set(catId, mp)
    }
    mp.set(month, (mp.get(month) ?? 0) + abs)
    overallByCat.set(catId, (overallByCat.get(catId) ?? 0) + abs)
  }
  const topCatIds = Array.from(overallByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)
  const trendsCategories = topCatIds.map((id) => {
    const monthMap = totalsByCat.get(id) ?? new Map()
    return {
      name: categoryNameById.get(id) ?? '—',
      total: Math.round((overallByCat.get(id) ?? 0) * 100) / 100,
      values: monthsList.map(
        (m) => Math.round((monthMap.get(m.month) ?? 0) * 100) / 100,
      ),
    }
  })

  // ── Report 4: Net Worth ─────────────────────────────────────
  const accountsNW = nwAccountsRes.data ?? []
  const txnsNW = nwTxnsRes.data ?? []
  const txnsByAccount = new Map<string, Array<{ date: string; amount: number }>>()
  for (const t of txnsNW) {
    const id = t.account_id as string
    const arr = txnsByAccount.get(id) ?? []
    arr.push({ date: t.date as string, amount: Number(t.amount) })
    txnsByAccount.set(id, arr)
  }
  const balanceToDOP = (amount: number, ccy: string | null) =>
    convertAmount(amount, parseCurrency(ccy), 'DOP', usdToDopRate)
  const contrib = (type: string, native: number) => {
    if (DEBT_TYPES_SET.has(type)) return -Math.abs(native)
    if (type === 'liability') return -native
    return native
  }
  const nwSeries = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const monthFirst = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const monthLast = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0)
    const cutoffDate = monthLast > today ? today : monthLast
    const cutoffISO = formatISODateLocal(cutoffDate)
    let nw = 0
    for (const acc of accountsNW) {
      const accTxns = txnsByAccount.get(acc.id as string) ?? []
      const future = accTxns.filter((t) => t.date > cutoffISO).reduce((s, t) => s + t.amount, 0)
      const native = Number(acc.balance) - future
      nw += balanceToDOP(
        contrib(acc.type as string, native),
        acc.currency as string | null,
      )
    }
    nwSeries.push({
      month: `${monthFirst.getFullYear()}-${String(monthFirst.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES_SHORT[monthFirst.getMonth()]} ${monthFirst.getFullYear()}`,
      value: Math.round(nw * 100) / 100,
    })
  }
  let totalCash = 0, totalAssets = 0, totalDebts = 0
  for (const acc of accountsNW) {
    const dop = balanceToDOP(Number(acc.balance), acc.currency as string | null)
    const type = acc.type as string
    if (CASH_TYPES.has(type)) totalCash += dop
    else if (type === 'asset') totalAssets += dop
    else if (type === 'liability') totalDebts += dop
    else if (DEBT_TYPES_SET.has(type)) totalDebts += Math.abs(dop)
  }

  // ── Report 5: Age of Money (FIFO) ───────────────────────────
  type Lot = { date: string; remaining: number }
  const lots: Lot[] = []
  const aomMonthly = new Map<string, { spent: number; weightedAge: number }>()
  for (const t of aomTxnsRes.data ?? []) {
    const amount = toDOP(Number(t.amount), t.account_id as string)
    const date = t.date as string
    if (amount > 0) {
      lots.push({ date, remaining: amount })
    } else if (amount < 0) {
      let toSpend = Math.abs(amount)
      while (toSpend > 0.005 && lots.length > 0) {
        const oldest = lots[0]
        const consume = Math.min(oldest.remaining, toSpend)
        const a = new Date(oldest.date)
        const b = new Date(date)
        const age = Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000))
        const monthKey = date.slice(0, 7)
        const m = aomMonthly.get(monthKey) ?? { spent: 0, weightedAge: 0 }
        m.spent += consume
        m.weightedAge += consume * age
        aomMonthly.set(monthKey, m)
        oldest.remaining -= consume
        toSpend -= consume
        if (oldest.remaining < 0.005) lots.shift()
      }
    }
  }
  const aomSeries = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mAgg = aomMonthly.get(monthKey)
    const age = mAgg && mAgg.spent > 0.005 ? mAgg.weightedAge / mAgg.spent : null
    aomSeries.push({
      month: monthKey,
      label: `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      ageDays: age === null ? null : Math.round(age * 10) / 10,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    budgetCurrency,
    usdToDopRate,
    reports: {
      breakdown: {
        periodLabel: `${MONTH_NAMES_FULL[today.getMonth()]} ${today.getFullYear()}`,
        totalIncome: Math.round(bdIncome * 100) / 100,
        totalExpenses: Math.round(bdExpense * 100) / 100,
        uncategorized: Math.round(uncategorized * 100) / 100,
        categories: breakdownCategories,
      },
      incomeVsExpense: {
        rangeLabel: 'Últimos 12 meses',
        months: monthsList,
        totalIncome: Math.round(totalIE.income * 100) / 100,
        totalExpense: Math.round(totalIE.expense * 100) / 100,
      },
      trends: {
        rangeLabel: 'Últimos 12 meses',
        months: monthsList.map((m) => ({ month: m.month, label: m.label })),
        categories: trendsCategories,
      },
      netWorth: {
        rangeLabel: 'Últimos 12 meses',
        series: nwSeries,
        totalCash: Math.round(totalCash * 100) / 100,
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalDebts: Math.round(totalDebts * 100) / 100,
        currentNetWorth: nwSeries.length > 0 ? nwSeries[nwSeries.length - 1].value : 0,
      },
      ageOfMoney: {
        rangeLabel: 'Últimos 12 meses',
        series: aomSeries,
      },
    },
  }
}

// ── Salud de deudas ─────────────────────────────────────────────
//
// Server action específico que reúne todo lo necesario para el
// reporte de salud de deudas. Snapshot actual + serie histórica
// de deuda + KPIs derivados (intereses/mes, razón deuda/ingresos,
// APR ponderado).

export interface DebtAccount {
  id: string
  name: string
  type: string
  /** Balance siempre devuelto positivo (magnitud de deuda). */
  balanceDOP: number
  balanceNative: number
  nativeCurrency: 'DOP' | 'USD'
  /** APR en % (ej. 22.5). null si la cuenta no tiene tasa. */
  apr: number | null
  /** Intereses estimados al mes en DOP. */
  monthlyInterestDOP: number
  cycleCloseDay: number | null
}

export interface DebtHealthResult {
  error?: string
  /** Total de deudas convertido a DOP. */
  totalDebtDOP?: number
  /** Tasa APR ponderada por balance (en %). */
  weightedAvgApr?: number
  /** Intereses estimados al mes sumando todas las cuentas. */
  totalMonthlyInterest?: number
  /** Promedio mensual de ingresos últimos 3 meses (para razones). */
  avgMonthlyIncome?: number
  /** Total cash disponible (para ratio deuda/cash). */
  totalCashDOP?: number
  /** Razón deuda/ingresos = (total deudas) / (ingresos anuales estimados). */
  debtToIncomeRatio?: number | null
  /** Razón deuda/cash = (total deudas) / (cash disponible). */
  debtToCashRatio?: number | null
  /** Lista detallada por cuenta. */
  debts?: DebtAccount[]
  /** Serie histórica de deuda total (12 meses). */
  debtHistory?: { month: string; label: string; total: number }[]
  /** Alertas activas. */
  alerts?: { severity: 'high' | 'medium' | 'low'; message: string }[]
}

const DEBT_TYPES_HEALTH = new Set([
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'medical_debt',
  'other_debt',
])

export async function fetchDebtHealth(): Promise<DebtHealthResult> {
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

  const today = todayLocalDate()
  const todayISO = formatISODateLocal(today)
  const monthCount = 12
  const seriesFirst = new Date(today.getFullYear(), today.getMonth() - (monthCount - 1), 1)
  const seriesFirstISO = formatISODateLocal(seriesFirst)
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
  const threeMonthsAgoISO = formatISODateLocal(threeMonthsAgo)

  const [accountsRes, allTxnsRes, incomeTxnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, balance, currency, interest_rate_apr, cycle_close_day, closed')
      .eq('budget_id', budget.id),
    // Toda la data de txns en debt accounts para reconstruir balance histórico
    supabase
      .from('transactions')
      .select('date, account_id, amount')
      .eq('budget_id', budget.id),
    // Ingresos de los últimos 3 meses para calcular avg
    supabase
      .from('transactions')
      .select('date, account_id, amount')
      .eq('budget_id', budget.id)
      .is('transfer_account_id', null)
      .not('payee_name', 'in', `("${SYSTEM_PAYEES.join('","')}")`)
      .gte('date', threeMonthsAgoISO)
      .lte('date', todayISO)
      .gt('amount', 0),
  ])

  if (accountsRes.error) {
    return { error: safeError(accountsRes.error, 'analisis') }
  }

  const accounts = accountsRes.data ?? []
  const accountsActive = accounts.filter((a) => !a.closed)

  const accountCcyMap = new Map<string, Currency>()
  for (const a of accounts) {
    accountCcyMap.set(a.id as string, parseCurrency(a.currency as string | null))
  }

  // Cash disponible (DOP)
  let totalCashDOP = 0
  for (const acc of accountsActive) {
    if (CASH_TYPES.has(acc.type as string)) {
      totalCashDOP += convertAmount(
        Number(acc.balance),
        parseCurrency(acc.currency as string | null),
        'DOP',
        usdToDopRate,
      )
    }
  }

  // Build list of debt accounts con métricas por cuenta
  const debts: DebtAccount[] = []
  let totalDebtDOP = 0
  let totalMonthlyInterest = 0
  let weightedAprSum = 0 // numerator = Σ(balance × apr)

  for (const acc of accountsActive) {
    const type = acc.type as string
    if (!DEBT_TYPES_HEALTH.has(type)) continue
    const balanceNative = Math.abs(Number(acc.balance))
    const currency = parseCurrency(acc.currency as string | null)
    const balanceDOP = convertAmount(balanceNative, currency, 'DOP', usdToDopRate)
    const apr = acc.interest_rate_apr != null ? Number(acc.interest_rate_apr) : null
    const monthlyInterestDOP = apr != null && apr > 0 ? (balanceDOP * apr) / 100 / 12 : 0
    debts.push({
      id: acc.id as string,
      name: acc.name as string,
      type,
      balanceDOP: Math.round(balanceDOP * 100) / 100,
      balanceNative: Math.round(balanceNative * 100) / 100,
      nativeCurrency: currency,
      apr,
      monthlyInterestDOP: Math.round(monthlyInterestDOP * 100) / 100,
      cycleCloseDay: acc.cycle_close_day != null ? Number(acc.cycle_close_day) : null,
    })
    totalDebtDOP += balanceDOP
    totalMonthlyInterest += monthlyInterestDOP
    if (apr != null) weightedAprSum += balanceDOP * apr
  }

  // Sort por mayor balance primero (lo más relevante arriba)
  debts.sort((a, b) => b.balanceDOP - a.balanceDOP)

  const weightedAvgApr = totalDebtDOP > 0 ? weightedAprSum / totalDebtDOP : 0

  // Ingresos avg mensual (últimos 3 meses)
  const incomeTxns = incomeTxnsRes.data ?? []
  let totalIncome3m = 0
  for (const t of incomeTxns) {
    const ccy = accountCcyMap.get(t.account_id as string) ?? 'DOP'
    totalIncome3m += convertAmount(Number(t.amount), ccy, 'DOP', usdToDopRate)
  }
  const avgMonthlyIncome = totalIncome3m / 3

  // Razones
  const debtToIncomeRatio =
    avgMonthlyIncome > 0.005
      ? totalDebtDOP / (avgMonthlyIncome * 12)
      : null
  const debtToCashRatio =
    totalCashDOP > 0.005 ? totalDebtDOP / totalCashDOP : null

  // ── Historia mensual de deuda (12 puntos) ─────────────────
  const txnsByAccount = new Map<string, Array<{ date: string; amount: number }>>()
  for (const t of allTxnsRes.data ?? []) {
    const id = t.account_id as string
    const arr = txnsByAccount.get(id) ?? []
    arr.push({ date: t.date as string, amount: Number(t.amount) })
    txnsByAccount.set(id, arr)
  }

  const debtHistory: { month: string; label: string; total: number }[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const monthFirst = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const monthLast = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0)
    const cutoffDate = monthLast > today ? today : monthLast
    const cutoffISO = formatISODateLocal(cutoffDate)
    let monthDebtDOP = 0
    for (const acc of accountsActive) {
      const type = acc.type as string
      if (!DEBT_TYPES_HEALTH.has(type)) continue
      const accTxns = txnsByAccount.get(acc.id as string) ?? []
      const future = accTxns
        .filter((t) => t.date > cutoffISO)
        .reduce((s, t) => s + t.amount, 0)
      const reconstructedNative = Number(acc.balance) - future
      const absNative = Math.abs(reconstructedNative)
      monthDebtDOP += convertAmount(
        absNative,
        parseCurrency(acc.currency as string | null),
        'DOP',
        usdToDopRate,
      )
    }
    debtHistory.push({
      month: `${monthFirst.getFullYear()}-${String(monthFirst.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES_SHORT[monthFirst.getMonth()]} ${monthFirst.getFullYear()}`,
      total: Math.round(monthDebtDOP * 100) / 100,
    })
  }

  // ── Alertas ──────────────────────────────────────────────
  const alerts: NonNullable<DebtHealthResult['alerts']> = []
  // APRs altos (>28% es predatorio en DR)
  const highAprDebts = debts.filter((d) => d.apr != null && d.apr > 28)
  for (const d of highAprDebts) {
    alerts.push({
      severity: 'high',
      message: `${d.name} tiene APR ${d.apr?.toFixed(1)}% — sobre el promedio del mercado DR (24-28%). Prioriza pagarla.`,
    })
  }
  // Razón deuda/ingresos > 0.5x = estrés financiero
  if (debtToIncomeRatio !== null && debtToIncomeRatio > 0.5) {
    alerts.push({
      severity: debtToIncomeRatio > 1 ? 'high' : 'medium',
      message: `Tu razón deuda/ingresos es ${debtToIncomeRatio.toFixed(2)}x — sobre 0.5x se considera estrés financiero. Sobre 1.0x el banco te ve como riesgo.`,
    })
  }
  // Cycle close day próximo (3 días o menos)
  const todayDay = today.getDate()
  for (const d of debts) {
    if (d.cycleCloseDay == null) continue
    const daysUntil = (d.cycleCloseDay - todayDay + 30) % 30
    if (daysUntil <= 3 && daysUntil > 0) {
      alerts.push({
        severity: 'low',
        message: `${d.name}: corte día ${d.cycleCloseDay} — quedan ${daysUntil} ${daysUntil === 1 ? 'día' : 'días'}. Paga antes para evitar intereses.`,
      })
    }
  }

  return {
    totalDebtDOP: Math.round(totalDebtDOP * 100) / 100,
    weightedAvgApr: Math.round(weightedAvgApr * 100) / 100,
    totalMonthlyInterest: Math.round(totalMonthlyInterest * 100) / 100,
    avgMonthlyIncome: Math.round(avgMonthlyIncome * 100) / 100,
    totalCashDOP: Math.round(totalCashDOP * 100) / 100,
    debtToIncomeRatio:
      debtToIncomeRatio === null ? null : Math.round(debtToIncomeRatio * 100) / 100,
    debtToCashRatio:
      debtToCashRatio === null ? null : Math.round(debtToCashRatio * 100) / 100,
    debts,
    debtHistory,
    alerts,
  }
}
