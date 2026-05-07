'use client'

import { Sun, Moon, SunMoon } from 'lucide-react'
import { useTheme, type ThemeMode } from './ThemeProvider'

const ORDER: ThemeMode[] = ['light', 'dark', 'system']
const NEXT: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}
// Icons reflect the CURRENT mode at a glance:
//   - Sun = ya estás en claro
//   - Moon = ya estás en oscuro
//   - SunMoon = sigues al sistema (más legible que un Monitor)
// El tooltip explica qué pasa si tocas (pasa al siguiente modo).
const ICONS = { light: Sun, dark: Moon, system: SunMoon } as const
const LABELS: Record<ThemeMode, string> = {
  light: 'Modo claro',
  dark: 'Modo oscuro',
  system: 'Sigue al sistema',
}
const NEXT_LABELS: Record<ThemeMode, string> = {
  light: 'Cambiar a oscuro',
  dark: 'Cambiar a sistema',
  system: 'Cambiar a claro',
}

/**
 * Compact icon button that cycles through light → dark → system.
 * Mirrors the segmented control in /app/ajustes but lives in the
 * topbar for one-tap access.
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const Icon = ICONS[mode]

  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`${LABELS[mode]} — ${NEXT_LABELS[mode].toLowerCase()}`}
      title={`${LABELS[mode]} · ${NEXT_LABELS[mode]}`}
      className="w-9 h-9 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
    >
      <Icon size={16} strokeWidth={2.2} />
    </button>
  )
}

export { ORDER as THEME_ORDER }
