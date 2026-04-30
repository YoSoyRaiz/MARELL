import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>
}) {
  const params = await searchParams
  const passwordReset = params.reset === 'ok'

  return (
    <div className="card p-7">
      <h2 className="text-xl font-semibold mb-1">Bienvenido de vuelta</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Inicia sesión para continuar
      </p>

      {passwordReset && (
        <div
          className="rounded-xl border px-3 py-2.5 mb-5 flex items-start gap-2"
          style={{
            borderColor: 'var(--brand-2)',
            background: 'rgba(61,220,151,0.06)',
          }}
        >
          <CheckCircle2
            size={14}
            strokeWidth={2.4}
            style={{ color: 'var(--brand-2)', flexShrink: 0, marginTop: 2 }}
          />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
            Contraseña actualizada. Inicia sesión con la nueva.
          </p>
        </div>
      )}

      <LoginForm />
      <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="font-medium" style={{ color: 'var(--accent2)' }}>
          Crea una
        </Link>
      </p>
    </div>
  )
}
