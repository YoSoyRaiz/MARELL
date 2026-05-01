import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { convertAmount, parseCurrency, type Currency } from '@/lib/money'
import { AppShell } from './AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, plan, onboarded, trial_ends_at, pro_expires_at, notifications_last_seen',
    )
    .eq('id', user.id)
    .single()

  if (!profile?.onboarded) redirect('/onboarding')

  // Single admin check for the layout — passed down so the profile popover
  // can show the "Admin" link only when relevant.
  const { data: isAdmin } = await supabase.rpc('is_admin')

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name, currency, usd_to_dop_rate')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let readyToAssign = 0
  // Notifications collected for the topbar bell. Computed alongside RtA
  // so we don't issue extra Supabase round-trips on every page load.
  type Notification = {
    id: string
    severity: 'info' | 'warn' | 'critical'
    title: string
    message: string
    href?: string
    icon?: 'alert' | 'calendar' | 'flame' | 'target' | 'sparkles'
  }
  const notifications: Notification[] = []

  // Trial / pro expiration awareness — show as soon as the user has
  // less than 7 days left so they can renew without friction.
  const now = Date.now()
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null
  if (
    profile?.plan === 'trial' &&
    trialEnd &&
    Number.isFinite(trialEnd) &&
    trialEnd > now
  ) {
    const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000))
    if (daysLeft <= 7) {
      notifications.push({
        id: 'trial-ending',
        severity: daysLeft <= 2 ? 'critical' : 'warn',
        title: `Tu prueba termina en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`,
        message: 'Activa Pro para no perder acceso a metas, programadas y reportes.',
        href: '/app/ajustes',
        icon: 'calendar',
      })
    }
  }
  const proEnd = profile?.pro_expires_at ? new Date(profile.pro_expires_at).getTime() : null
  if (
    profile?.plan === 'pro' &&
    proEnd &&
    Number.isFinite(proEnd) &&
    proEnd > now
  ) {
    const daysLeft = Math.ceil((proEnd - now) / (24 * 60 * 60 * 1000))
    if (daysLeft <= 14) {
      notifications.push({
        id: 'pro-expiring',
        severity: daysLeft <= 3 ? 'warn' : 'info',
        title: `Pro vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`,
        message: 'Renueva para mantener todas las funciones activas.',
        href: '/app/ajustes',
        icon: 'calendar',
      })
    }
  }

  if (budget) {
    // Ready to Assign = total_cash − Σ(category.available_lifetime)
    // where category.available = lifetime_assignments + lifetime_activity.
    // This is the YNAB formula: cash that hasn't been earmarked to a
    // category. Carry-over of unspent balances + overspending coverage
    // both fall out of this naturally.
    const [accountsRes, assignsRes, txnsRes, subsRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('balance, type, currency, closed')
        .eq('budget_id', budget.id),
      supabase.from('monthly_assignments').select('assigned').eq('budget_id', budget.id),
      supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('budget_id', budget.id)
        .not('category_id', 'is', null),
      supabase
        .from('subtransactions')
        .select('amount, transactions!inner(budget_id)')
        .eq('transactions.budget_id', budget.id)
        .not('category_id', 'is', null),
    ])

    const cashTypes = ['checking', 'savings', 'cash']
    const budgetCurrency: Currency = parseCurrency(budget.currency as string | null)
    const fxRate = Number(
      (budget as { usd_to_dop_rate?: number | null }).usd_to_dop_rate ?? 60,
    )
    // USD-denominated accounts in a DOP budget (or vice versa) get
    // normalized into the budget's currency before summing so the topbar
    // pill never lies about how much cash actually buys. Closed accounts
    // are archived and their balance is irrelevant to current cash.
    const totalCash = (accountsRes.data ?? [])
      .filter((a) => cashTypes.includes(a.type as string) && a.closed !== true)
      .reduce((s, a) => {
        const accCurrency = parseCurrency(a.currency as string | null)
        const native = Number(a.balance)
        return s + convertAmount(native, accCurrency, budgetCurrency, fxRate)
      }, 0)

    const totalAssignedLifetime = (assignsRes.data ?? []).reduce(
      (s, a) => s + Number(a.assigned),
      0,
    )
    const totalCategorizedActivity =
      (txnsRes.data ?? []).reduce((s, t) => s + Number(t.amount), 0) +
      (subsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

    const sumCategoryAvailable = totalAssignedLifetime + totalCategorizedActivity
    readyToAssign = Math.round((totalCash - sumCategoryAvailable) * 100) / 100

    // Scheduled transactions firing in the next 3 days → bell.
    const todayStr = new Date(Date.now() - 4 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const soonStr = new Date(Date.now() + (3 * 24 - 4) * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const { data: dueSoon } = await supabase
      .from('scheduled_transactions')
      .select('id, payee_name, next_date')
      .eq('budget_id', budget.id)
      .eq('active', true)
      .gte('next_date', todayStr)
      .lte('next_date', soonStr)
      .order('next_date', { ascending: true })
      .limit(5)
    for (const s of dueSoon ?? []) {
      notifications.push({
        id: `due-${s.id}`,
        severity: 'info',
        title: `Programado: ${s.payee_name ?? 'Sin nombre'}`,
        message: `Se materializa el ${s.next_date}.`,
        href: '/app/programadas',
        icon: 'calendar',
      })
    }

    // Negative ready-to-assign → critical alert.
    if (readyToAssign < -0.005) {
      notifications.unshift({
        id: 'rta-neg',
        severity: 'critical',
        title: 'Asignaste de más',
        message: 'Reduce alguna categoría o mueve dinero entre ellas para cuadrar.',
        href: '/app/plan',
        icon: 'alert',
      })
    }
  }

  return (
    <AppShell
      displayName={profile?.display_name ?? null}
      email={user.email ?? null}
      plan={profile?.plan ?? 'trial'}
      trialEndsAt={(profile?.trial_ends_at as string | null) ?? null}
      budget={budget ?? null}
      readyToAssign={readyToAssign}
      isAdmin={!!isAdmin}
      notifications={notifications}
      notificationsLastSeen={
        (profile?.notifications_last_seen as string | null) ?? null
      }
    >
      {children}
    </AppShell>
  )
}
