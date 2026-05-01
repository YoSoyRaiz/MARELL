'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, X } from 'lucide-react'

interface ShortcutDef {
  keys: string
  label: string
}

const NAV_SHORTCUTS: { sequence: string; href: string; label: string }[] = [
  { sequence: 'gr', href: '/app', label: 'Resumen' },
  { sequence: 'gp', href: '/app/plan', label: 'Plan' },
  { sequence: 'gt', href: '/app/transacciones', label: 'Transacciones' },
  { sequence: 'gc', href: '/app/cuentas', label: 'Cuentas' },
  { sequence: 'gm', href: '/app/metas', label: 'Metas' },
  { sequence: 'gs', href: '/app/programadas', label: 'Programadas' },
  { sequence: 'ge', href: '/app/analisis', label: 'Análisis' },
  { sequence: 'gh', href: '/app/herramientas', label: 'Cálculos' },
]

const HELP_LIST: ShortcutDef[] = [
  { keys: 'g  r', label: 'Ir a Resumen' },
  { keys: 'g  p', label: 'Ir a Plan' },
  { keys: 'g  t', label: 'Ir a Transacciones' },
  { keys: 'g  c', label: 'Ir a Cuentas' },
  { keys: 'g  m', label: 'Ir a Metas' },
  { keys: 'g  s', label: 'Ir a Programadas' },
  { keys: 'g  e', label: 'Ir a Análisis' },
  { keys: 'g  h', label: 'Ir a Cálculos' },
  { keys: 'n', label: 'Nueva transacción' },
  { keys: 'a', label: 'Asignar dinero' },
  { keys: '?', label: 'Mostrar atajos' },
  { keys: 'Esc', label: 'Cerrar diálogos' },
]

/**
 * Custom-event names the shortcut handler dispatches. Components mount
 * a window listener for the events relevant to them — only one handler
 * should be active per page (TopBar for assign, the active page for
 * new-transaction).
 */
export const SHORTCUT_EVENTS = {
  newTransaction: 'marell:new-transaction',
  assignMoney: 'marell:assign-money',
} as const

const PREFIX_TIMEOUT_MS = 1200

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    let prefix: string | null = null
    let prefixTimer: number | null = null

    const clearPrefix = () => {
      prefix = null
      if (prefixTimer !== null) {
        window.clearTimeout(prefixTimer)
        prefixTimer = null
      }
    }

    const onKey = (e: KeyboardEvent) => {
      // Ignore inside text fields and when modifier-laden combos are pressed
      // — those belong to the browser or specific page handlers.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      // Help dialog handling first.
      if (e.key === 'Escape' && helpOpen) {
        setHelpOpen(false)
        clearPrefix()
        return
      }

      // "?" opens the help dialog regardless of prefix state.
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen((v) => !v)
        clearPrefix()
        return
      }

      const k = e.key.toLowerCase()

      if (prefix === 'g') {
        const match = NAV_SHORTCUTS.find((s) => s.sequence === `g${k}`)
        clearPrefix()
        if (match) {
          e.preventDefault()
          router.push(match.href)
        }
        return
      }

      if (k === 'g') {
        prefix = 'g'
        prefixTimer = window.setTimeout(clearPrefix, PREFIX_TIMEOUT_MS)
        return
      }

      if (k === 'n') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.newTransaction))
        return
      }

      if (k === 'a') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.assignMoney))
        return
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearPrefix()
    }
  }, [router, helpOpen])

  if (!helpOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setHelpOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative w-full max-w-md rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)] inline-flex items-center gap-2">
              <Keyboard size={12} strokeWidth={2.4} />
              Atajos
            </div>
            <h2
              id="shortcuts-title"
              className="text-[18px] font-bold mt-1 leading-tight tracking-tight"
            >
              Muévete <span className="gradient-text">rápido</span> por MARELL
            </h2>
            <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              Presiona <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-[var(--border)] font-mono text-[10px]">g</kbd> seguido de la letra para navegar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>
        <ul className="px-6 py-4 divide-y divide-[var(--border)]">
          {HELP_LIST.map((s) => (
            <li
              key={s.keys}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <span className="text-[13px] text-[var(--text)]">{s.label}</span>
              <span className="font-mono text-[11px] text-[var(--text2)] tracking-wide">
                {s.keys.split('  ').map((k, i, arr) => (
                  <span key={i} className="inline-flex items-center">
                    <kbd className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-[var(--border)]">
                      {k}
                    </kbd>
                    {i < arr.length - 1 && (
                      <span className="mx-1 text-[var(--muted2)]">luego</span>
                    )}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
