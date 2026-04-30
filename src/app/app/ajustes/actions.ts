'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Currency = 'DOP' | 'USD'

export async function updateProfile(input: { displayName: string }) {
  const name = input.displayName.trim()
  if (!name) return { error: 'Nombre requerido' }
  if (name.length > 80) return { error: 'Nombre demasiado largo (máx. 80)' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function updateBudgetSettings(input: {
  budgetId: string
  name: string
  currency: Currency
}) {
  const name = input.name.trim()
  if (!input.budgetId) return { error: 'Presupuesto requerido' }
  if (!name) return { error: 'Nombre del presupuesto requerido' }
  if (name.length > 80) return { error: 'Nombre demasiado largo (máx. 80)' }
  if (input.currency !== 'DOP' && input.currency !== 'USD') {
    return { error: 'Moneda inválida' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', input.budgetId)
    .eq('created_by', user.id)
    .single()
  if (!budget) return { error: 'Sin acceso al presupuesto' }

  const { error } = await supabase
    .from('budgets')
    .update({ name, currency: input.currency })
    .eq('id', input.budgetId)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

export async function setEmailNotifications(enabled: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({
      email_notifications: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { success: true as const }
}

// Permanently deletes the user's account: cascades through their budget
// data + profile, then removes the auth.users row via the security-definer
// `public.delete_my_account` RPC. After this returns the session is no
// longer valid; sign out and redirect to /login regardless.
export async function deleteMyAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.rpc('delete_my_account')
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/login')
}
