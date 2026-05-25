import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizardClient } from './OnboardingWizardClient'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarded')
    .eq('id', user.id)
    .single()

  if (profile?.onboarded) redirect('/app')

  // Limbo guard: if the user already has a budget AND that budget has
  // categories, they finished the meaningful part of onboarding even
  // if they bailed before the final "mark onboarded" step. Mark them
  // onboarded and send them to the app instead of looping the wizard.
  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (budget) {
    const { count } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('budget_id', budget.id as string)
    if ((count ?? 0) > 0) {
      await supabase
        .from('profiles')
        .update({ onboarded: true })
        .eq('id', user.id)
      redirect('/app')
    }
  }

  return (
    <OnboardingWizardClient
      initialName={profile?.display_name ?? null}
      userId={user.id}
    />
  )
}
