import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/ui/Logo'
import { AdminClient, type AdminUser } from './AdminClient'
import { AlertBanner } from '@/components/ui/AlertBanner'

export const metadata = {
  title: 'MARELL · Admin',
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) redirect('/app')

  const { data: rows, error } = await supabase.rpc('admin_list_users')

  const users: AdminUser[] = (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    plan: r.plan,
    trialEndsAt: r.trial_ends_at,
    proExpiresAt: r.pro_expires_at,
    approved: r.approved,
    onboarded: r.onboarded,
    signedUpAt: r.signed_up_at,
    lastSignInAt: r.last_sign_in_at,
  }))

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--s1)]/60 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo height={28} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-2)]">
              Admin
            </span>
          </div>
          <Link
            href="/app"
            className="text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            Volver a la app
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {error ? (
          <AlertBanner tone="danger">
            No pude cargar usuarios: {error.message}
          </AlertBanner>
        ) : (
          <AdminClient users={users} />
        )}
      </main>
    </div>
  )
}
