import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvitation } from '@/app/app/familia/actions'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

/**
 * GET muestra detalles + un botón. POST (Server Action) acepta.
 *
 * Antes esta página ejecutaba acceptInvitation() directamente en el
 * render del GET, lo que significaba que cualquier prefetch del
 * browser o crawler con la cookie del user podía aceptar la
 * invitación sin consentimiento explícito. Ahora requiere clic
 * deliberado. (Auditoría 2026-05-24, M4.)
 */
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
    redirect(
      `/login?next=${encodeURIComponent(`/aceptar-invitacion?token=${token}`)}`,
    )
  }

  // Fetch metadata para mostrar quién invitó y a qué presupuesto antes
  // de aceptar.
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

  // Server action handler para el form POST
  async function handleAccept(formData: FormData) {
    'use server'
    const formToken = (formData.get('token') as string | null)?.trim()
    if (!formToken) return
    const result = await acceptInvitation(formToken)
    if ('error' in result && result.error) {
      redirect(
        `/aceptar-invitacion?token=${formToken}&error=${encodeURIComponent(result.error)}`,
      )
    }
    redirect('/app?welcome=invited')
  }

  // Look up budget name para el preview.
  const { data: budget } = await admin
    .from('budgets')
    .select('name')
    .eq('id', inv.budget_id as string)
    .single()

  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-8 space-y-5">
        <div className="space-y-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(61,220,151,0.10)] flex items-center justify-center mx-auto text-[var(--brand-2)]">
            <CheckCircle2 size={24} strokeWidth={2.2} />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight leading-tight">
            Te invitaron a un <span className="gradient-text">presupuesto</span>
          </h1>
          <p className="text-body text-[var(--text2)] leading-relaxed">
            Al aceptar te unes al presupuesto{' '}
            <strong className="text-[var(--text)]">
              {(budget?.name as string | undefined) ?? 'compartido'}
            </strong>{' '}
            con rol{' '}
            <strong className="text-[var(--text)]">{inv.role as string}</strong>.
          </p>
        </div>

        <form action={handleAccept} className="flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center justify-center gap-2 transition-[filter]"
          >
            Aceptar invitación
            <ArrowRight size={14} strokeWidth={2.4} />
          </button>
          <Link
            href="/app"
            className="h-10 text-center text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)] inline-flex items-center justify-center transition-colors"
          >
            Cancelar
          </Link>
        </form>
      </div>
    </main>
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
        <div className="text-body text-[var(--text)] leading-relaxed">{children}</div>
      </div>
    </main>
  )
}
