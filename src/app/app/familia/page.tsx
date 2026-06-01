import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveBudgetId } from '@/lib/budget/active'
import { FamiliaClient, type ListMember, type ListInvite } from './FamiliaClient'

export default async function FamiliaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { budgetId: activeBudgetId } = await getActiveBudgetId(supabase)
  const { data: budget } = activeBudgetId
    ? await supabase
        .from('budgets')
        .select('id, name')
        .eq('id', activeBudgetId)
        .maybeSingle()
    : { data: null }

  if (!budget) {
    return <FamiliaClient budgetName={null} ownerId={user.id} members={[]} invitations={[]} />
  }

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('budget_members')
      .select('id, user_id, role, joined_at')
      .eq('budget_id', budget.id),
    supabase
      .from('budget_invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('budget_id', budget.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ])

  // Resolve user_id → email/name. Need admin client because auth.users
  // isn't directly readable.
  const memberIds = (membersRes.data ?? []).map((m) => m.user_id as string)
  const emailById = new Map<string, string>()
  const nameById = new Map<string, string>()
  if (memberIds.length > 0) {
    const admin = createAdminClient()
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of usersList?.users ?? []) {
      if (u.email && memberIds.includes(u.id)) emailById.set(u.id, u.email)
    }
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name')
      .in('id', memberIds)
    for (const p of profiles ?? []) {
      const name = p.display_name as string | null
      if (name) nameById.set(p.id as string, name)
    }
  }

  const members: ListMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id as string,
    userId: m.user_id as string,
    role: m.role as 'owner' | 'editor' | 'viewer',
    email: emailById.get(m.user_id as string) ?? null,
    displayName: nameById.get(m.user_id as string) ?? null,
    joinedAt: (m.joined_at as string | null) ?? null,
    isYou: m.user_id === user.id,
  }))

  const invitations: ListInvite[] = (invitesRes.data ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as 'editor' | 'viewer',
    expiresAt: i.expires_at as string,
    createdAt: i.created_at as string,
  }))

  return (
    <FamiliaClient
      budgetName={(budget.name as string) ?? null}
      ownerId={user.id}
      members={members}
      invitations={invitations}
    />
  )
}
