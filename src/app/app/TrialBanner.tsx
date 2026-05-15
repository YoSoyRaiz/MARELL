'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, AlertCircle } from 'lucide-react'

interface TrialBannerProps {
  plan: string
  trialEndsAt: string | null
}

// Persistent dismiss key per day. Banner reappears each new day so
// the user doesn't lose visibility on the countdown, but won't nag
// every page nav of the same session.
const dismissKey = (daysLeft: number) =>
  `marell:trial-banner-dismissed:${new Date().toISOString().slice(0, 10)}:${daysLeft}`

/**
 * Top-of-app banner for users on a trial. Three states:
 *   - >7 days left: hidden (countdown only in profile sidebar)
 *   - 2–7 days: amber, dismissible (per-day)
 *   - 0–1 days or expired: coral, NOT dismissible — user needs to act
 *
 * Wired into AppShell so it shows on every /app/* page until the user
 * either upgrades or the trial ends.
 */
export function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isTrial = plan === 'trial' && !!trialEndsAt
  const trialEnd = isTrial ? new Date(trialEndsAt!).getTime() : null
  const now = Date.now()
  const msLeft = trialEnd ? trialEnd - now : null
  const daysLeft = msLeft !== null ? Math.ceil(msLeft / 86_400_000) : null

  // Severity drives copy + color + dismissibility.
  const expired = daysLeft !== null && daysLeft <= 0
  const critical = daysLeft !== null && daysLeft >= 1 && daysLeft <= 1
  const warn = daysLeft !== null && daysLeft >= 2 && daysLeft <= 7
  const visible = isTrial && (expired || critical || warn)

  // Read dismissed flag on mount — keyed per day+daysLeft so a fresh
  // day re-shows the banner naturally.
  useEffect(() => {
    setMounted(true)
    if (!visible || daysLeft === null) return
    if (expired || critical) return // never dismissible at the end
    try {
      const v = localStorage.getItem(dismissKey(daysLeft))
      if (v === '1') setDismissed(true)
    } catch {}
  }, [visible, daysLeft, expired, critical])

  if (!mounted || !visible || dismissed) return null

  const handleDismiss = () => {
    if (daysLeft === null) return
    try {
      localStorage.setItem(dismissKey(daysLeft), '1')
    } catch {}
    setDismissed(true)
  }

  const tone =
    expired || critical
      ? {
          bg: 'bg-[rgba(255,79,106,0.10)]',
          border: 'border-[var(--danger)]/40',
          icon: AlertCircle,
          iconColor: 'text-[var(--coral-text)]',
          accent: 'text-[var(--coral-text)]',
        }
      : {
          bg: 'bg-[rgba(245,200,66,0.10)]',
          border: 'border-[var(--warn)]/40',
          icon: Sparkles,
          iconColor: 'text-[var(--warn-text)]',
          accent: 'text-[var(--warn-text)]',
        }

  const Icon = tone.icon

  const title = expired
    ? 'Tu prueba terminó'
    : daysLeft === 1
      ? 'Tu prueba termina mañana'
      : daysLeft === 0
        ? 'Tu prueba termina hoy'
        : `Tu prueba termina en ${daysLeft} días`

  const subtitle = expired
    ? 'Reactiva tu acceso a metas, programadas y reportes pasando a Pro.'
    : 'Pasa a Pro para mantener acceso continuo cuando termine.'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative w-full ${tone.bg} ${tone.border} border-b`}
    >
      <div className="mx-auto max-w-[1700px] px-4 sm:px-6 md:px-8 py-2.5 flex items-center gap-3">
        <Icon size={16} strokeWidth={2.2} className={`shrink-0 ${tone.iconColor}`} />
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className={`text-[13px] font-semibold ${tone.accent}`}>
            {title}
          </span>
          <span className="text-[12px] text-[var(--text2)] truncate">
            {subtitle}
          </span>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 h-8 px-3.5 rounded-lg gradient-bg text-[#0B0B0C] text-[12px] font-semibold inline-flex items-center gap-1.5 hover:brightness-105 active:brightness-95 transition-[filter]"
        >
          Pasar a Pro
        </Link>
        {!expired && !critical && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Ocultar este aviso por hoy"
            className="shrink-0 w-7 h-7 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] inline-flex items-center justify-center transition-colors"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  )
}
