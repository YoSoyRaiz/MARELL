import Link from 'next/link'
import { SignupForm } from './SignupForm'

export default function SignupPage() {
  return (
    <div className="card p-7">
      <h2 className="text-xl font-semibold mb-1">Crea tu cuenta</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        30 días de prueba gratis. Sin tarjeta.
      </p>
      <SignupForm />
      <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--accent2)' }}>
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
