// Service worker entry. Built by `@serwist/next` at compile time and
// served from the app root as `/sw.js`. Strategies:
//
//   - Static assets (JS, CSS, fonts, images) → cache-first with
//     `defaultCache` so the second visit is instant offline.
//   - API + server actions → network-first (we ALWAYS prefer fresh
//     financial data; offline reads are nice-to-have, never auth).
//   - Push notifications → handled here so the user gets payment
//     reminders / scheduled-txn alerts when the app isn't open.

import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()

// ── Push notifications ─────────────────────────────────────
// The server endpoint /api/push/subscribe persists the subscription
// to the database; the cron / webhook flow can then push to it via
// web-push. The payload is a JSON `{ title, body, url? }`.

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: { title?: string; body?: string; url?: string } = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { body: event.data.text() }
  }
  const title = payload.title ?? 'MARELL'
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/brand/icon.svg',
    badge: '/brand/icon.svg',
    data: { url: payload.url ?? '/app' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url =
    (event.notification.data as { url?: string } | undefined)?.url ?? '/app'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus an existing tab if one is already on this URL; else open.
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
