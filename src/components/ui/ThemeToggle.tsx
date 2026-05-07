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
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Auto',
}
const FULL_LABELS: Record<ThemeMode, string> = {
  light: 'Modo claro',
  dark: 'Modo oscuro',
  system: 'Sigue al sistema',
}
const NEXT_LABELS: Record<ThemeMode, string> = {
  light: 'Cambiar a oscuro',
  dark: 'Cambiar a sistema',
  system: 'Cambiar a claro',
}

// Pill palette per mode — cada uno tiene su propio tint para que el
// toggle se sienta vivo y llame atención. El icono va arriba del color
// dominante del modo (ámbar para sol, índigo para luna, brand para auto).
const PALETTES: Record<ThemeMode, string> = {
  light:
    'border-[#F5C842]/50 bg-[rgba(245,200,66,0.14)] text-[#A07300] hover:bg-[rgba(245,200,66,0.22)]',
  dark:
    'border-[#7C92FF]/40 bg-[rgba(124,146,255,0.14)] text-[#5364C0] hover:bg-[rgba(124,146,255,0.22)]',
  system:
    'border-[var(--brand-2)]/40 bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] hover:bg-[rgba(61,220,151,0.20)]',
}

/**
 * Pill-style toggle that cycles light → dark → system. Each mode
 * paints the pill with its own tint (warm amber for sol, cool indigo
 * for luna, brand green for auto) so the control feels alive and
 * draws attention compared to a plain icon button.
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const Icon = ICONS[mode]
  const palette = PALETTES[mode]

  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`${FULL_LABELS[mode]} — ${NEXT_LABELS[mode].toLowerCase()}`}
      title={`${FULL_LABELS[mode]} · ${NEXT_LABELS[mode]}`}
      className={`h-9 rounded-full border inline-flex items-center gap-1.5 px-3 text-[12px] font-semibold transition-colors ${palette}`}
    >
      <Icon size={14} strokeWidth={2.4} />
      <span className="hidden sm:inline">{LABELS[mode]}</span>
    </button>
  )
}

export { ORDER as THEME_ORDER }
