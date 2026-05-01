'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Slim banner that drops down from the top of the app when the
 * browser reports it's offline. Most fetches will fail anyway, but
 * this gives the user a clear "this isn't your fault" signal so they
 * don't think the app is broken.
 *
 * Sits inside AppShell (above the topbar) so it's visible across
 * every authenticated page.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[var(--coral)]/15 border-b border-[var(--coral)]/30 px-4 py-2 flex items-center justify-center gap-2 text-[12px] text-[var(--coral)] font-medium"
    >
      <WifiOff size={13} strokeWidth={2.4} />
      Sin conexión — los cambios se guardan cuando vuelvas en línea.
    </div>
  )
}
