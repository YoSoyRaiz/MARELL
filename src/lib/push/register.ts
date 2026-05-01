// Browser-side helper that registers the user's PushSubscription
// against the server. Safe to call multiple times — `subscribe()`
// returns the existing subscription if it's already in place.
//
// VAPID public key comes from NEXT_PUBLIC_VAPID_PUBLIC_KEY. Generate
// the pair with `npx web-push generate-vapid-keys` and paste the
// values into Vercel env (public on this var, private on
// VAPID_PRIVATE_KEY which only the server reads).

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerPushNotifications(): Promise<{
  ok: boolean
  reason?: string
}> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublic) return { ok: false, reason: 'no-vapid-key' }

  const reg = await navigator.serviceWorker.ready
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  const existing = await reg.pushManager.getSubscription()
  // Cast through BufferSource so TS's stricter ArrayBufferView typing
  // accepts the Uint8Array we built. PushManager handles either at
  // runtime; the strictness is purely a compile-time annotation.
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidPublic,
      ) as unknown as BufferSource,
    }))

  // Persist on the server. Idempotent — server upserts by endpoint.
  const json = sub.toJSON() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  })
  if (!res.ok) return { ok: false, reason: 'server-rejected' }
  return { ok: true }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}
