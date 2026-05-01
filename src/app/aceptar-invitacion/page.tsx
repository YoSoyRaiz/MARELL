import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvitation } from '@/app/app/familia/actions'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token?.trim()
  if (!token) {
    return <Message tone="error">Falta el token de la invitación.</Message>
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Bounce to login with a returnTo so they come back here.
    redirect(
      `/login?next=${encodeURIComponent(`/aceptar-invitacion?token=${token}`)}`,
    )
  }

  // Fetch the invitation metadata up-front so we can show the user
  // who's inviting them before we accept.
  const admin = createAdminClient()
  const { data: inv } = await admin
    .from('budget_invitations')
    .select('id, email, role, expires_at, accepted_at, budget_id')
    .eq('token', token)
    .maybeSingle()

  if (!inv) {
    return <Message tone="error">Invitación no encontrada o expirada.</Message>
  }
  if (inv.accepted_at) {
    return (
      <Message tone="info">
        Esta invitación ya se usó. Si tú la aceptaste, puedes ir directo al{' '}
        <Link href="/app" className="text-[var(--brand-2)] underline underline-offset-4">
          presupuesto
        </Link>
        .
      </Message>
    )
  }
  if (new Date(inv.expires_at as string).getTime() < Date.now()) {
    return <Message tone="error">Esta invitación expiró.</Message>
  }

  const result = await acceptInvitation(token)
  if ('error' in result) {
    return <Message tone="error">{result.error}</Message>
  }

  return (
    <Message tone="success">
      ¡Listo! Ya eres miembro del presupuesto.{' '}
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-[var(--brand-2)] font-semibold hover:underline underline-offset-4"
      >
        Ir al resumen <ArrowRight size={13} strokeWidth={2.4} />
      </Link>
    </Message>
  )
}

function Message({
  tone,
  children,
}: {
  tone: 'success' | 'error' | 'info'
  children: React.ReactNode
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle
  const color =
    tone === 'success'
      ? 'text-[var(--brand-2)]'
      : tone === 'error'
        ? 'text-[var(--coral)]'
        : 'text-[var(--info)]'

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-8 text-center space-y-4">
        <div
          className={`w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto ${color}`}
        >
          <Icon size={24} strokeWidth={2.2} />
        </div>
        <div className="text-[14px] text-[var(--text)] leading-relaxed">{children}</div>
      </div>
    </main>
  )
}
