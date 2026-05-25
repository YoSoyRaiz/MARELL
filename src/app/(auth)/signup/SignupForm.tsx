'use client'

import { useActionState } from 'react'
import { MailCheck } from 'lucide-react'
import { signup, type SignupState } from '../actions'

const initial: SignupState = { status: 'idle' }

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signup,
    initial,
  )

  // After a successful submission the form is replaced by a
  // "check your inbox" confirmation card. The user has no session
  // until they click the link in the email we just sent.
  if (state.status === 'sent') {
    return (
      <div className="rounded-2xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.06)] p-6 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[rgba(61,220,151,0.16)] text-[var(--brand-2)] inline-flex items-center justify-center">
          <MailCheck size={22} strokeWidth={2.2} />
        </div>
        <h2 className="text-h3 font-bold text-[var(--text)]">
          Revisa tu correo
        </h2>
        <p className="text-body-sm leading-relaxed text-[var(--text2)]">
          Te enviamos un enlace de confirmación a{' '}
          <strong className="text-[var(--text)]">{state.email}</strong>.
          Cuando lo abras, tu prueba de 31 días arranca automáticamente.
        </p>
        <p className="text-meta leading-relaxed text-[var(--muted)] pt-2">
          ¿No te llegó? Revisa en spam, o vuelve a intentar con el mismo
          email — te reenviaremos otro.
        </p>
      </div>
    )
  }

  const errorMsg = state.status === 'error' ? state.error : null

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="display_name"
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text2)' }}
        >
          ¿Cómo te llamas?
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          autoComplete="name"
          placeholder="Tu nombre"
          className="w-full"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text2)' }}
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className="w-full"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text2)' }}
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full"
        />
      </div>

      {errorMsg && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,79,106,0.10)', color: 'var(--coral-text)' }}
        >
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 px-4 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
        style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
      >
        {pending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
