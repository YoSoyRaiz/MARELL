'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import {
  confirmSignupEmail,
  adminNewSignupEmail,
} from '@/lib/email/templates'

export type AuthState = {
  error?: string
} | undefined

/** Discriminated state for the signup form: idle until submission,
 *  then either an error to display inline or a "check your inbox"
 *  success view that swaps out the form. */
export type SignupState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; error: string }

const ADMIN_NOTIFY_EMAIL = 'maxtudiodesign@gmail.com'

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

/**
 * Signup flow:
 *   1. Create the auth user via the admin API with email_confirm=false,
 *      so Supabase does NOT send its default confirmation email.
 *   2. Generate a signup confirmation link (the same token Supabase
 *      would have emailed) and deliver it via Resend with our
 *      branded template so the logo and copy are MARELL's.
 *   3. Fire-and-forget admin notification to the founder.
 *   4. Return `status: 'sent'` so the form swaps to a "check your
 *      inbox" view — the user has no session until they confirm.
 *
 * Trial fields (subscription_status='trialing', pro_expires_at) are
 * set by a Postgres trigger on profile insert (migration
 * 2026_05_14_trial_auto_start.sql) so the day-counter starts the
 * moment the profile exists.
 */
export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const displayName = String(formData.get('display_name') || '').trim()

  const emailErr = validateEmail(email)
  if (emailErr) return { status: 'error', error: emailErr }
  const passErr = validatePassword(password)
  if (passErr) return { status: 'error', error: passErr }
  if (!displayName) return { status: 'error', error: 'El nombre es requerido' }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const origin = `${proto}://${host}`

  const admin = createAdminClient()

  // Step 1 — create the user without triggering Supabase's email.
  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { display_name: displayName },
  })

  if (createErr || !createData?.user) {
    const msg = (createErr?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return {
        status: 'error',
        error:
          'Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?',
      }
    }
    return { status: 'error', error: createErr?.message ?? 'Error al crear cuenta' }
  }

  const newUserId = createData.user.id

  // Helper: roll back the half-created user when a later step (link
  // generation or email delivery) fails. Cascade migration cleans up
  // profile + budgets automatically; this just removes the auth row
  // so the email is free to retry without an "already registered"
  // error. Logs but never throws — best-effort cleanup.
  const rollback = async (reason: string) => {
    try {
      await admin.auth.admin.deleteUser(newUserId)
      console.warn(`[signup rollback] removed ${email} after: ${reason}`)
    } catch (err) {
      console.error('[signup rollback failed]', { email, reason, err })
    }
  }

  // Step 2 — generate the signup confirmation link Supabase would
  // have emailed itself, so we can drop it into our own template.
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    })
  if (linkErr || !linkData?.properties?.action_link) {
    await rollback('generateLink failed')
    return {
      status: 'error',
      error: 'No pudimos generar tu enlace de confirmación. Intenta de nuevo.',
    }
  }
  const confirmUrl = linkData.properties.action_link

  // Step 3 — send the branded confirmation email to the user. If
  // Resend isn't configured (no API key), sendEmail logs and returns
  // true so dev/preview keeps working.
  const userTpl = confirmSignupEmail(displayName, confirmUrl)
  const userSent = await sendEmail({
    to: email,
    subject: userTpl.subject,
    html: userTpl.html,
    text: userTpl.text,
  })
  if (!userSent) {
    await rollback('confirmation email send failed')
    return {
      status: 'error',
      error:
        'No pudimos enviarte el correo de confirmación. Inténtalo de nuevo en unos minutos.',
    }
  }

  // Step 4 — heads-up to the founder. Awaited (vs fire-and-forget)
  // because Vercel serverless kills work that hasn't completed by
  // the time the action returns — `void promise` was getting cut off
  // before Resend's HTTP call finished. Wrapped in try/catch so a
  // failed admin notification never breaks signup for the user.
  const adminTpl = adminNewSignupEmail(email, displayName, new Date())
  try {
    const adminSent = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: adminTpl.subject,
      html: adminTpl.html,
      text: adminTpl.text,
    })
    if (!adminSent) {
      console.warn('[signup] admin notification email did not send', { email })
    }
  } catch (err) {
    console.error('[signup] admin notification threw', err)
  }

  return { status: 'sent', email }
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
