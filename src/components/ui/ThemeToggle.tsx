'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from './ThemeProvider'

const ORDER: ThemeMode[] = ['light', 'dark', 'system']
const NEXT: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const
const LABELS: Record<ThemeMode, string> = {
  light: 'Tema claro',
  dark: 'Tema oscuro',
  system: 'Tema del sistema',
}

/**
 * Compact icon button that cycles through light → dark → system.
 * Mirrors the segmented control in /app/ajustes but lives in the
 * topbar for one-tap access. Uses ResolvedTheme to pick the icon so
 * "system" shows whichever it currently resolves to.
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const Icon = ICONS[mode]

  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={LABELS[mode]}
      title={`${LABELS[mode]} — toca para cambiar`}
      className="w-9 h-9 rounded-xl text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
    >
      <Icon size={16} strokeWidth={2.2} />
    </button>
  )
}

export { ORDER as THEME_ORDER }
