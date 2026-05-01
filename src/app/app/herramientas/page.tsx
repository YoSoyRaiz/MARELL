import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HerramientasClient } from './HerramientasClient'

export default async function HerramientasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <HerramientasClient />
}
