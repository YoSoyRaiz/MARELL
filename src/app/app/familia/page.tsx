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

  // Para mostrar "último acceso" de cada auditor en la sección de
  // Auditores, traemos el log de accesos del budget. RLS asegura que
  // solo miembros (incluido el cliente owner) pueden leerlo.
  // Tabla nueva → cast a unknown.
  const accessLogRes = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (
            k: string,
            v: string,
          ) => {
            order: (
              k: string,
              o: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data:
                  | { actor_user_id: string; action: string; created_at: string }[]
                  | null
              }>
            }
          }
        }
      }
    }
  )
    .from('budget_access_log')
    .select('actor_user_id, action, created_at')
    .eq('budget_id', budget.id)
    .order('created_at', { ascending: false })
    .limit(200)
  const lastAccessByUser = new Map<string, string>()
  for (const row of accessLogRes.data ?? []) {
    if (!lastAccessByUser.has(row.actor_user_id)) {
      lastAccessByUser.set(row.actor_user_id, row.created_at)
    }
  }

  // ID de la agency_relationship correspondiente a cada auditor —
  // necesario para llamar endClientRelationship desde la UI del
  // cliente.
  // Cast del role porque los types generados de Supabase no incluyen
  // todavía 'auditor' en el enum (agregado en migration 2026_05_28).
  const auditorMemberIds = (membersRes.data ?? [])
    .filter((m) => (m.role as string) === 'auditor')
    .map((m) => m.user_id as string)
  const agencyByAuditor = new Map<string, string>()
  if (auditorMemberIds.length > 0) {
    const arRes = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              in: (k: string, v: string[]) => Promise<{
                data:
                  | { id: string; auditor_user_id: string }[]
                  | null
              }>
            }
          }
        }
      }
    )
      .from('agency_relationships')
      .select('id, auditor_user_id')
      .eq('client_budget_id', budget.id)
      .in('auditor_user_id', auditorMemberIds)
    for (const r of arRes.data ?? []) {
      agencyByAuditor.set(r.auditor_user_id, r.id)
    }
  }

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
    role: m.role as 'owner' | 'editor' | 'viewer' | 'auditor',
    email: emailById.get(m.user_id as string) ?? null,
    displayName: nameById.get(m.user_id as string) ?? null,
    joinedAt: (m.joined_at as string | null) ?? null,
    isYou: m.user_id === user.id,
    lastAccessAt: lastAccessByUser.get(m.user_id as string) ?? null,
    agencyRelationshipId: agencyByAuditor.get(m.user_id as string) ?? null,
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
