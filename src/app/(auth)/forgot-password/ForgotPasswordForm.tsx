'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { requestPasswordReset, type ResetRequestState } from '../actions'

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    { status: 'idle' },
  )

  if (state.status === 'sent') {
    return (
      <div
        className="rounded-xl border px-4 py-5 flex items-start gap-3"
        style={{
          borderColor: 'var(--brand-2)',
          background: 'rgba(61,220,151,0.06)',
        }}
      >
        <CheckCircle2
          size={18}
          strokeWidth={2.2}
          style={{ color: 'var(--brand-2)', flexShrink: 0, marginTop: 2 }}
        />
        <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          <p className="font-semibold mb-1">Revisa tu correo.</p>
          <p style={{ color: 'var(--text2)' }}>
            Si el email está registrado, te enviamos un enlace para crear una nueva
            contraseña. El enlace expira en 1 hora.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
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

      {state.status === 'error' && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 px-4 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
        style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
      >
        {pending ? 'Enviando…' : 'Enviar enlace de recuperación'}
      </button>
    </form>
  )
}
