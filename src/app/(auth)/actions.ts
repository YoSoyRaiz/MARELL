'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  error?: string
} | undefined

function validateEmail(email: string): string | null {
  if (!email) return 'El email es requerido'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'La contraseña es requerida'
  if (password.length < 8) return 'Mínimo 8 caracteres'
  return null
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const displayName = String(formData.get('display_name') || '').trim()

  const emailErr = validateEmail(email)
  if (emailErr) return { error: emailErr }
  const passErr = validatePassword(password)
  if (passErr) return { error: passErr }
  if (!displayName) return { error: 'El nombre es requerido' }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const origin = `${proto}://${host}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  const emailErr = validateEmail(email)
  if (emailErr) return { error: emailErr }
  if (!password) return { error: 'La contraseña es requerida' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Email o contraseña incorrectos' }

  revalidatePath('/', 'layout')
  redirect('/app')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ── Password recovery ────────────────────────────────────────────
// resetPasswordForEmail sends an email with a magic link that lands on
// /auth/callback?code=...&next=/reset-password. The callback exchanges the
// code for a session, then /reset-password prompts the user for a new
// password and calls updatePassword (below).

export type ResetRequestState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'error'; error: string }

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const emailErr = validateEmail(email)
  if (emailErr) return { status: 'error', error: emailErr }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const origin = `${proto}://${host}`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Don't leak which emails are registered: always return "sent" unless we
  // hit an unexpected error from Supabase.
  if (error && !/email/i.test(error.message)) {
    return { status: 'error', error: error.message }
  }

  return { status: 'sent' }
}

export type UpdatePasswordState = { error?: string } | undefined

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  const passErr = validatePassword(password)
  if (passErr) return { error: passErr }
  if (password !== confirm) return { error: 'Las contraseñas no coinciden' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'El enlace expiró. Solicita uno nuevo desde "Olvidé mi contraseña".' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  // Sign out so the next login uses the new password (Supabase keeps the
  // recovery session alive otherwise).
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login?reset=ok')
}
