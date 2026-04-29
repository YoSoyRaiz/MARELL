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

// Wipes all the user's financial data (budget cascade + profile flags) and
// signs them out. The auth.users record itself persists — true auth deletion
// requires a service-role function we can add later.
export async function deleteMyAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Delete owned budgets (cascades to accounts, categories, transactions,
  // assignments, scheduled, etc. via FK on delete cascade).
  const { error: delBudgetErr } = await supabase
    .from('budgets')
    .delete()
    .eq('created_by', user.id)
  if (delBudgetErr) return { error: delBudgetErr.message }

  // Reset profile so a fresh sign-in starts at onboarding.
  await supabase
    .from('profiles')
    .update({ onboarded: false, display_name: null })
    .eq('id', user.id)

  await supabase.auth.signOut()
  redirect('/login')
}
