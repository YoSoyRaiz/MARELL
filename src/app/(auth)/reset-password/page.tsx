import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  // The recovery code from the email gets exchanged for a session in
  // /auth/callback before redirecting here. If there's no session at all,
  // the link is invalid or expired — bounce back to forgot-password.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/forgot-password?error=expired')
  }

  return (
    <div className="card p-7">
      <h2 className="text-xl font-semibold mb-1">Crea tu nueva contraseña</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Mínimo 8 caracteres. Al guardarla, te pediremos iniciar sesión otra vez.
      </p>
      <ResetPasswordForm />
      <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
        <Link href="/login" className="font-medium" style={{ color: 'var(--accent2)' }}>
          Cancelar
        </Link>
      </p>
    </div>
  )
}
