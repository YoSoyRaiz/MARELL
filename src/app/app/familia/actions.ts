'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { budgetInvitationEmail } from '@/lib/email/templates'
import { ensurePro } from '@/lib/billing/check-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://marell.app'

export interface InviteInput {
  email: string
  role: 'editor' | 'viewer'
}

export async function inviteToBudget(input: InviteInput) {
  const gate = await ensurePro()
  if (!gate.ok) return { error: gate.error }
  const email = input.email.trim().toLowerCase()
  if (!email || !/^.+@.+\..+$/.test(email)) {
    return { error: 'Email inválido' }
  }
  if (input.role !== 'editor' && input.role !== 'viewer') {
    return { error: 'Rol inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: budget } = await supabase
    .from('budgets')
    .select('id, name')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!budget) return { error: 'Sin presupuesto' }

  // Don't double-invite an email that already accepted.
  const { data: existing } = await supabase
    .from('budget_invitations')
    .select('id, accepted_at')
    .eq('budget_id', budget.id)
    .ilike('email', email)
    .is('accepted_at', null)
    .maybeSingle()
  if (existing) {
    return { error: 'Ya tienes una invitación pendiente a ese correo' }
  }

  const token = randomBytes(24).toString('base64url')

  const { error: insErr } = await supabase
    .from('budget_invitations')
    .insert({
      budget_id: budget.id,
      invited_by: user.id,
      email,
      role: input.role,
      token,
    } as never)
  if (insErr) return { error: insErr.message }

  // Look up the inviter's display name for the email.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()
  const inviterName =
    (profile?.display_name as string | null) ?? user.email ?? 'Un amigo'

  const acceptUrl = `${APP_URL}/aceptar-invitacion?token=${encodeURIComponent(token)}`
  const tpl = budgetInvitationEmail(inviterName, budget.name as string, acceptUrl)
  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  })

  revalidatePath('/app/familia')
  return { success: true as const }
}

/**
 * Accept an invitation and join the budget. Run from the public
 * /aceptar-invitacion route after the user signs in or signs up.
 */
export async function acceptInvitation(token: string) {
  if (!token) return { error: 'Token requerido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Necesitas iniciar sesión' }

  // Use admin client to bypass RLS — the public read policy on
  // budget_invitations is scoped enough that we know the token is the
  // auth here, but admin client lets us write to budget_members
  // without the inviter being signed in.
  const admin = createAdminClient()

  const { data: inv } = await admin
    .from('budget_invitations')
    .select('id, budget_id, role, email, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!inv) return { error: 'Invitación no encontrada' }
  if (inv.accepted_at) return { error: 'Esta invitación ya se usó' }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return { error: 'Esta invitación expiró' }
  }
  // Strict email match: the signed-in user's email must equal the
  // invited address. Without this, a leaked token would let anyone
  // accept the invite. Token + email together is the auth.
  const userEmail = (user.email ?? '').toLowerCase()
  const invEmail = (inv.email as string).toLowerCase()
  if (!userEmail || !invEmail || userEmail !== invEmail) {
    return {
      error:
        'Esta invitación es para otra cuenta. Inicia sesión con el correo al que llegó la invitación.',
    }
  }

  // Already a member?
  const { data: existingMember } = await admin
    .from('budget_members')
    .select('id')
    .eq('budget_id', inv.budget_id as string)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingMember) {
    return { error: 'Ya eres miembro de este presupuesto' }
  }

  const { error: memErr } = await admin.from('budget_members').insert({
    budget_id: inv.budget_id as string,
    user_id: user.id,
    role: inv.role as 'owner' | 'editor' | 'viewer',
  } as never)
  if (memErr) return { error: memErr.message }

  await admin
    .from('budget_invitations')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    } as never)
    .eq('id', inv.id as string)

  return { success: true as const, budgetId: inv.budget_id as string }
}

export async function removeMember(memberId: string) {
  if (!memberId) return { error: 'Miembro requerido' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // RLS only lets the owner manage budget_members so this delete is
  // implicitly authorized.
  const { error } = await supabase.from('budget_members').delete().eq('id', memberId)
  if (error) return { error: error.message }

  revalidatePath('/app/familia')
  return { success: true as const }
}

export async function changeMemberRole(
  memberId: string,
  role: 'editor' | 'viewer',
) {
  if (!memberId) return { error: 'Miembro requerido' }
  if (role !== 'editor' && role !== 'viewer') return { error: 'Rol inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('budget_members')
    .update({ role } as never)
    .eq('id', memberId)
  if (error) return { error: error.message }

  revalidatePath('/app/familia')
  return { success: true as const }
}

export async function revokeInvitation(invitationId: string) {
  if (!invitationId) return { error: 'Invitación requerida' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('budget_invitations')
    .delete()
    .eq('id', invitationId)
  if (error) return { error: error.message }

  revalidatePath('/app/familia')
  return { success: true as const }
}
