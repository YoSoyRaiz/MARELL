import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface SubscribePayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Persist a Web Push subscription so the server can later push to it
 * via web-push. Called from the client right after the user grants
 * notification permission.
 *
 * The endpoint is unique per device, so re-subscribing from the same
 * device just refreshes the keys + last_seen.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: SubscribePayload
  try {
    body = (await request.json()) as SubscribePayload
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: 'Subscription incompleta' },
      { status: 400 },
    )
  }

  const ua = request.headers.get('user-agent') ?? null

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: ua,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { endpoint } = (await request.json().catch(() => ({}))) as {
    endpoint?: string
  }
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
