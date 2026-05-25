import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import {
  upcomingScheduledEmail,
  trialEndingEmail,
  proExpiringEmail,
  type UpcomingScheduledItem,
} from '@/lib/email/templates'
import { parseCurrency } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel Cron signs requests with `Authorization: Bearer ${CRON_SECRET}`.
// External callers also need to know the secret to fire this manually.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  // Fail-closed: si CRON_SECRET no está, RECHAZAR en TODOS los envs.
  // Antes el fallthrough en non-prod dejaba el cron accesible a
  // cualquiera con la URL en preview de Vercel — incluyendo envío
  // real de emails. Para testing local, setea CRON_SECRET en .env.local.
  // (Auditoría 2026-05-24, A5.)
  if (!expected) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

const DAY_MS = 86400000

interface BudgetIndex {
  budgetId: string
  ownerId: string
  currency: string
}

interface AccountIndex {
  id: string
  name: string
  budgetId: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://marell.app'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today.getTime() + 3 * DAY_MS) // 3 days ahead
  const horizonISO = isoDate(horizon)

  // 1. Pull profiles with notifications on, joined to auth.users for email.
  const { data: profileRows, error: profilesErr } = await supabase
    .from('profiles')
    .select(
      'id, display_name, plan, trial_ends_at, pro_expires_at, email_notifications, approved',
    )
    .eq('email_notifications', true)
    .eq('approved', true)

  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 })
  }
  if (!profileRows || profileRows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Hit auth.admin to map id → email (the admin SDK is required because
  // auth.users is in the auth schema and not directly readable).
  const { data: usersList } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })
  const emailById = new Map<string, string>()
  for (const u of usersList?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  // 2. Pull all budgets + accounts to look up currency / account names later.
  const { data: budgets } = await supabase
    .from('budgets')
    .select('id, created_by, currency')
  const budgetByOwner = new Map<string, BudgetIndex[]>()
  for (const b of budgets ?? []) {
    const arr = budgetByOwner.get(b.created_by as string) ?? []
    arr.push({ budgetId: b.id as string, ownerId: b.created_by as string, currency: b.currency as string })
    budgetByOwner.set(b.created_by as string, arr)
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, budget_id')
  const accountById = new Map<string, AccountIndex>()
  for (const a of accounts ?? []) {
    accountById.set(a.id as string, {
      id: a.id as string,
      name: a.name as string,
      budgetId: a.budget_id as string,
    })
  }

  // 3. Pull all active scheduled txns firing in the horizon window.
  const allBudgetIds = (budgets ?? []).map((b) => b.id as string)
  const upcomingByOwner = new Map<string, UpcomingScheduledItem[]>()

  if (allBudgetIds.length > 0) {
    const { data: scheduled } = await supabase
      .from('scheduled_transactions')
      .select('budget_id, account_id, payee_name, amount, next_date')
      .eq('active', true)
      .gte('next_date', isoDate(today))
      .lte('next_date', horizonISO)
      .in('budget_id', allBudgetIds)

    for (const s of scheduled ?? []) {
      const budgetId = s.budget_id as string
      const ownerEntry = budgets?.find((b) => b.id === budgetId)
      if (!ownerEntry) continue
      const owner = ownerEntry.created_by as string

      const acct = accountById.get(s.account_id as string)
      if (!acct) continue

      const daysUntil = Math.max(
        0,
        Math.round((parseISODate(s.next_date as string).getTime() - today.getTime()) / DAY_MS),
      )

      const amount = Number(s.amount)
      const item: UpcomingScheduledItem = {
        payeeName: s.payee_name as string,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' : 'expense',
        daysUntil,
        accountName: acct.name,
      }
      const arr = upcomingByOwner.get(owner) ?? []
      arr.push(item)
      upcomingByOwner.set(owner, arr)
    }
  }

  // 4. For each profile, decide what to send.
  let sentCount = 0
  const sendErrors: string[] = []

  for (const p of profileRows) {
    const userId = p.id as string
    const email = emailById.get(userId)
    if (!email) continue

    const displayName = p.display_name as string | null
    const ownedBudgets = budgetByOwner.get(userId) ?? []
    const currency = parseCurrency((ownedBudgets[0]?.currency as string | null) ?? 'DOP')

    // 4a. Upcoming scheduled
    const upcoming = upcomingByOwner.get(userId) ?? []
    if (upcoming.length > 0) {
      const tpl = upcomingScheduledEmail(displayName, upcoming, appUrl, currency)
      const ok = await sendEmail({ to: email, ...tpl })
      if (ok) sentCount++
      else sendErrors.push(`upcoming → ${email}`)
    }

    // 4b. Trial ending — when trial_ends_at lands in [today, today+3d]
    if (p.plan === 'trial' && p.trial_ends_at) {
      const ends = new Date(p.trial_ends_at as string)
      const days = Math.round((ends.getTime() - today.getTime()) / DAY_MS)
      if (days >= 0 && days <= 3) {
        const tpl = trialEndingEmail(displayName, days, appUrl)
        const ok = await sendEmail({ to: email, ...tpl })
        if (ok) sentCount++
        else sendErrors.push(`trial → ${email}`)
      }
    }

    // 4c. Pro expiring — same window
    if (p.plan === 'pro' && p.pro_expires_at) {
      const ends = new Date(p.pro_expires_at as string)
      const days = Math.round((ends.getTime() - today.getTime()) / DAY_MS)
      if (days >= 0 && days <= 7 && days % 7 === 0) {
        // Send once per week (today, +7d) to avoid spam.
        const tpl = proExpiringEmail(displayName, days, appUrl)
        const ok = await sendEmail({ to: email, ...tpl })
        if (ok) sentCount++
        else sendErrors.push(`pro → ${email}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    profilesScanned: profileRows.length,
    errors: sendErrors.length > 0 ? sendErrors : undefined,
  })
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
