'use client'

import { useActionState } from 'react'
import { signup, type AuthState } from '../actions'

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="display_name" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
          ¿Cómo te llamas?
        </label>
        <input id="display_name" name="display_name" type="text" required autoComplete="name" placeholder="Tu nombre" className="w-full" />
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@email.com" className="w-full" />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
          Contraseña
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="w-full" />
      </div>

      {state?.error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
          {state.error}
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
