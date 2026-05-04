import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CuentasClient, type ListAccount } from './CuentasClient'
import type { AccountType } from '@/app/onboarding/wizard/types'

export default async function CuentasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, usd_to_dop_rate')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!budget) {
    return <CuentasClient accounts={[]} hasBudget={false} usdToDopRate={60} />
  }

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select(
      'id, name, type, balance, note, closed, sort_order, currency, interest_rate_apr, cycle_close_day',
    )
    .eq('budget_id', budget.id)
    .order('sort_order', { ascending: true })

  const accounts: ListAccount[] = (accountsRaw ?? []).map((a) => {
    const row = a as Record<string, unknown>
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as AccountType,
      balance: Number(row.balance),
      note: (row.note as string | null) ?? null,
      closed: Boolean(row.closed),
      currency: ((row.currency as string | null) ?? 'DOP') as 'DOP' | 'USD',
      interestRateApr:
        row.interest_rate_apr != null ? Number(row.interest_rate_apr) : null,
      cycleCloseDay:
        row.cycle_close_day != null ? Number(row.cycle_close_day) : null,
    }
  })

  // The display layer needs to convert USD → DOP for "patrimonio neto" totals.
  // We pull the rate from the budget row (refreshed daily by the BCRD cron).
  const usdToDopRate = Number(
    (budget as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ?? 60,
  )

  return (
    <CuentasClient
      accounts={accounts}
      hasBudget={true}
      usdToDopRate={usdToDopRate}
    />
  )
}
