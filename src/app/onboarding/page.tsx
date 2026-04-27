import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './OnboardingWizard'

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

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <OnboardingWizard displayName={profile?.display_name ?? null} />
    </main>
  )
}
