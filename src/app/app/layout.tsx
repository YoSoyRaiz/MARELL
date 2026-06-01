import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeReadyToAssign } from '@/lib/budget'
import { getActiveBudgetId } from '@/lib/budget/active'
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

  // Active budget — usuario puede tener varios (propios + compartidos
  // por familia o como auditor de clientes). El helper lee de cookie,
  // valida membership y cae al primero por created_at para preservar
  // comportamiento single-budget.
  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = activeBudgetId
    ? await supabase
        .from('budgets')
        .select('id, name, currency, usd_to_dop_rate')
        .eq('id', activeBudgetId)
        .maybeSingle()
    : { data: null }

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
    // Ready to Assign cálculo movido a @/lib/budget para deduplicar la
    // misma computación que page.tsx hacía redundantemente.
    // (Auditoría de calidad L1.)
    const result = await computeReadyToAssign(supabase, {
      id: budget.id as string,
      currency: budget.currency as string | null,
      usd_to_dop_rate: (budget as { usd_to_dop_rate?: number | null })
        .usd_to_dop_rate,
    })
    readyToAssign = result.readyToAssign

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
