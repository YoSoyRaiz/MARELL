import Link from 'next/link'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="card p-7">
      <h2 className="text-xl font-semibold mb-1">¿Olvidaste tu contraseña?</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Ingresa tu email y te enviaremos un enlace para crear una nueva.
      </p>
      <ForgotPasswordForm />
      <p className="text-sm text-center mt-6" style={{ color: 'var(--muted)' }}>
        <Link href="/login" className="font-medium" style={{ color: 'var(--accent2)' }}>
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  )
}
