'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'

interface Ctx {
  open: boolean
  toggle: () => void
  close: () => void
}

const MobileNavCtx = createContext<Ctx | null>(null)

export function useMobileNav(): Ctx {
  const ctx = useContext(MobileNavCtx)
  if (!ctx) throw new Error('useMobileNav must be used inside <MobileNavProvider>')
  return ctx
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while open (matches modal pattern in the app).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <MobileNavCtx.Provider value={{ open, toggle, close }}>
      {children}
    </MobileNavCtx.Provider>
  )
}
