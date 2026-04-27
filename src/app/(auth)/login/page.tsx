import Link from 'next/link'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="card p-7">
      <h2 className="text-xl font-semibold mb-1">Bienvenido de vuelta</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Inicia sesión para continuar
      </p>
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
