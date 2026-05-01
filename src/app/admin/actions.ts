'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ActionResult {
  error?: string
  ok?: true
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'No autenticado' as const }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { supabase, error: 'Sin permisos' as const }
  return { supabase, error: null }
}

export async function recordPayment(
  targetId: string,
  months: number,
): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }
  if (!targetId) return { error: 'ID requerido' }
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    return { error: 'Meses inválidos (1–24)' }
  }
  const { error: rpcErr } = await supabase.rpc('admin_record_payment', {
    target_id: targetId,
    months,
  })
  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/admin', 'page')
  return { ok: true }
}

export async function extendTrial(
  targetId: string,
  days: number,
): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }
  if (!targetId) return { error: 'ID requerido' }
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { error: 'Días inválidos (1–365)' }
  }
  const { error: rpcErr } = await supabase.rpc('admin_extend_trial', {
    target_id: targetId,
    days,
  })
  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/admin', 'page')
  return { ok: true }
}

export async function setApproved(
  targetId: string,
  approved: boolean,
): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }
  if (!targetId) return { error: 'ID requerido' }
  const { error: rpcErr } = await supabase.rpc('admin_set_approved', {
    target_id: targetId,
    approved,
  })
  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/admin', 'page')
  return { ok: true }
}

export async function setFree(targetId: string): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }
  if (!targetId) return { error: 'ID requerido' }
  const { error: rpcErr } = await supabase.rpc('admin_set_free', {
    target_id: targetId,
  })
  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/admin', 'page')
  return { ok: true }
}

export async function deleteUser(targetId: string): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }
  if (!targetId) return { error: 'ID requerido' }
  const { error: rpcErr } = await supabase.rpc('admin_delete_user', {
    target_id: targetId,
  })
  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/admin', 'page')
  return { ok: true }
}
