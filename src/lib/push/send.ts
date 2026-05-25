// Server-side push sender. Uses the `web-push` lib + the VAPID
// keypair to deliver to a user's saved subscriptions.
//
// Failed deliveries (HTTP 410 = subscription gone) are auto-cleaned
// from the DB so we don't keep retrying dead endpoints.

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hola@marell.app'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys missing — generate with `npx web-push generate-vapid-keys`')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ delivered: number; cleaned: number }> {
  ensureConfigured()
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { delivered: 0, cleaned: 0 }

  let delivered = 0
  let cleaned = 0
  const json = JSON.stringify(payload)

  const aliveIds: string[] = []
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint as string,
          keys: { p256dh: s.p256dh as string, auth: s.auth as string },
        },
        json,
      )
      delivered += 1
      aliveIds.push(s.id as string)
    } catch (err: unknown) {
      // 410 Gone or 404 = subscription expired. Drop from DB so the
      // ledger doesn't keep filling with retries.
      const status =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : 0
      if (status === 410 || status === 404) {
        await admin.from('push_subscriptions').delete().eq('id', s.id as string)
        cleaned += 1
      }
    }
  }

  // Marca last_seen_at en las subs que SÍ funcionaron. Permite que un
  // cron periódico borre subs realmente abandonadas (más de 6 meses
  // sin haber sido tocadas). Auditoría 2026-05-24, B7.
  if (aliveIds.length > 0) {
    await admin
      .from('push_subscriptions')
      .update({ last_seen_at: new Date().toISOString() })
      .in('id', aliveIds)
  }

  return { delivered, cleaned }
}
