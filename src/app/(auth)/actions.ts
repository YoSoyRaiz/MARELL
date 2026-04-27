'use server'

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

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
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
