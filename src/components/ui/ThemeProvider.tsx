'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  /** What the user picked (or 'system' to follow the OS preference). */
  mode: ThemeMode
  /** What the page is actually rendering ('light' or 'dark'). */
  resolved: ResolvedTheme
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'marell:theme'

function readSystemPref(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/**
 * ThemeProvider keeps a `data-theme="light|dark"` attribute on
 * <html> so CSS variables (defined in globals.css) flip themselves.
 * Three modes: explicit light, explicit dark, or 'system' which
 * mirrors the OS preference and reacts to changes live.
 *
 * The matching pre-hydration script in <head> sets the attribute
 * before paint to avoid a dark→light flash on light-mode users.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [resolved, setResolved] = useState<ResolvedTheme>('dark')

  // Initial read after hydration.
  useEffect(() => {
    const stored = readStoredMode()
    setModeState(stored)
    setResolved(stored === 'system' ? readSystemPref() : stored)
  }, [])

  // Live-react when the OS preference changes (only matters in
  // 'system' mode).
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setResolved(mql.matches ? 'light' : 'dark')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [mode])

  // Apply the resolved theme to <html data-theme> so CSS picks it up.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    setResolved(next === 'system' ? readSystemPref() : next)
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Fallback when used outside the provider — safe defaults so
    // server components don't crash.
    return {
      mode: 'system' as ThemeMode,
      resolved: 'dark' as ResolvedTheme,
      setMode: () => {},
    }
  }
  return ctx
}

/**
 * Inline script string injected in the <head> of the root layout. It
 * runs before React hydrates and sets the data-theme attribute, so
 * users who chose light mode don't see a dark flash on first paint.
 *
 * Pure JS for size; mirrors readStoredMode + readSystemPref above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('marell:theme');var m=(v==='light'||v==='dark')?v:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',m);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`
