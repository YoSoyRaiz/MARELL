'use client'

import { useActionState } from 'react'
import { updatePassword, type UpdatePasswordState } from '../actions'

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    undefined,
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text2)' }}
        >
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full"
        />
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text2)' }}
        >
          Confirma la contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full"
        />
      </div>

      {state?.error && (
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
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
