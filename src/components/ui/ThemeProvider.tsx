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

function readSystemPref(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'light' || v === 'dark') return v
  // First-time visitors: seed from OS preference, then it's explicit
  // light/dark from there on — no live OS-pref reactivity.
  return readSystemPref()
}

/**
 * ThemeProvider keeps a `data-theme="light|dark"` attribute on
 * <html> so CSS variables (defined in globals.css) flip themselves.
 * Two modes only — light or dark. First-time visitors are seeded from
 * the OS preference; after that the choice is sticky in localStorage.
 *
 * The matching pre-hydration script in <head> sets the attribute
 * before paint to avoid a dark→light flash on light-mode users.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark')

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
    // server components don't crash.
    return {
      mode: 'dark' as ThemeMode,
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
 * Falls back to OS preference for first-time visitors.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('marell:theme');var m=(v==='light'||v==='dark')?v:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',m);var sb=localStorage.getItem('marell:sidebar-collapsed');document.documentElement.style.setProperty('--sidebar-w',sb==='true'?'72px':'240px');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--sidebar-w','240px');}})();`
