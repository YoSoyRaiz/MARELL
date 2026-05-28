'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  /** What the user picked. */
  mode: ThemeMode
  /** Same as mode — kept for API stability with older callers. */
  resolved: ResolvedTheme
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'marell:theme'

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'light' || v === 'dark') return v
  // First-time visitors arrancan en LIGHT por decisión de producto —
  // antes seedeábamos desde prefers-color-scheme pero el ojo
  // dominicano espera ver el primer paint en claro (más confianza,
  // menos sensación de "app oscura"). El toggle a dark queda a 1
  // click en el TopBar.
  return 'light'
}

/**
 * ThemeProvider keeps a `data-theme="light|dark"` attribute on
 * <html> so CSS variables (defined in globals.css) flip themselves.
 * Two modes — light (default) o dark. First-time visitors arrancan
 * en light; después la elección se persiste en localStorage.
 *
 * The matching pre-hydration script in <head> sets the attribute
 * before paint to avoid a flash on first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')

  // Initial read after hydration.
  useEffect(() => {
    setModeState(readStoredMode())
  }, [])

  // Apply the resolved theme to <html data-theme> so CSS picks it up.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, resolved: mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Fallback when used outside the provider — safe defaults so
    // server components don't crash. Default light matching el
    // default real del provider.
    return {
      mode: 'light' as ThemeMode,
      resolved: 'light' as ResolvedTheme,
      setMode: () => {},
    }
  }
  return ctx
}

/**
 * Inline script string injected in the <head> of the root layout. It
 * runs before React hydrates y setea el data-theme attribute para
 * evitar flash en first paint.
 *
 * Política: default LIGHT para first-time visitors (no leemos
 * prefers-color-scheme). Si el usuario hizo toggle a dark, la
 * preferencia vive en localStorage y la respetamos.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('marell:theme');var m=(v==='light'||v==='dark')?v:'light';document.documentElement.setAttribute('data-theme',m);var sb=localStorage.getItem('marell:sidebar-collapsed');document.documentElement.style.setProperty('--sidebar-w',sb==='true'?'72px':'240px');}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.setProperty('--sidebar-w','240px');}})();`
