'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle, Calendar, Flame, Target, Sparkles } from 'lucide-react'

export interface NotificationItem {
  id: string
  /** When set, the bell shows a red dot until the user opens the panel. */
  severity: 'info' | 'warn' | 'critical'
  title: string
  message: string
  href?: string
  icon?: 'alert' | 'calendar' | 'flame' | 'target' | 'sparkles'
}

const ICON_MAP: Record<NonNullable<NotificationItem['icon']>, React.ElementType> = {
  alert: AlertCircle,
  calendar: Calendar,
  flame: Flame,
  target: Target,
  sparkles: Sparkles,
}

interface NotificationBellProps {
  notifications: NotificationItem[]
  /** ISO timestamp of the last time this user opened the panel, or null. */
  lastSeenAt: string | null
  /** Server action to bump notifications_last_seen on the profile. */
  onMarkSeen: () => Promise<void>
}

export function NotificationBell({
  notifications,
  lastSeenAt,
  onMarkSeen,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Local override of "seen" so the dot disappears immediately on click,
  // before the server action round-trips. Initialized from the lastSeenAt
  // prop: if it's within the last hour we treat the panel as already seen.
  const [seenLocally, setSeenLocally] = useState(() => {
    if (!lastSeenAt) return false
    const lastMs = new Date(lastSeenAt).getTime()
    if (!Number.isFinite(lastMs)) return false
    return Date.now() - lastMs < 60 * 60 * 1000
  })

  const hasUnseen = notifications.length > 0 && !seenLocally

  // Click-outside + Esc close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const handleOpen = () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && hasUnseen) {
      setSeenLocally(true)
      // Fire-and-forget the server-side mark so the dot stays gone next
      // page load. We don't await — the UX is already responsive.
      onMarkSeen().catch(() => {
        // If it fails the dot will reappear on next load; that's ok.
      })
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
      >
        <Bell size={16} strokeWidth={2.2} />
        {hasUnseen && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--coral)] border border-[var(--s1)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step z-40">
          <header className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              Notificaciones
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              Lo que necesita tu atención hoy.
            </p>
          </header>
          {notifications.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] text-[var(--text2)] flex items-center justify-center mx-auto mb-3">
                <Bell size={18} strokeWidth={2} />
              </div>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                Todo en orden — ningún aviso pendiente.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {notifications.map((n) => {
                const Icon = n.icon ? ICON_MAP[n.icon] : Sparkles
                const tone =
                  n.severity === 'critical'
                    ? 'text-[var(--coral)]'
                    : n.severity === 'warn'
                      ? 'text-[var(--warn)]'
                      : 'text-[var(--info)]'
                const Wrapper: React.ElementType = n.href ? Link : 'div'
                const wrapperProps = n.href ? { href: n.href } : {}
                return (
                  <li key={n.id}>
                    <Wrapper
                      {...wrapperProps}
                      onClick={() => n.href && setOpen(false)}
                      className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-white/[0.04] ${tone} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <Icon size={14} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[var(--text)]">
                          {n.title}
                        </div>
                        <div className="text-[11.5px] text-[var(--muted)] mt-0.5 leading-relaxed">
                          {n.message}
                        </div>
                      </div>
                    </Wrapper>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
