import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Loguea el error real server-side. El cliente solo ve un código
    // genérico — antes la URL leakeaba info de Supabase auth en query
    // string (visible en logs del navegador, historial, screen shares).
    // (Auditoría 2026-05-24, B4.)
    console.error('[auth/callback] exchangeCodeForSession failed', error)
    return NextResponse.redirect(`${origin}/login?error=invalid_link`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
