'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { DocsSidebar } from './DocsSidebar'

export function DocsMobileNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir índice"
        className="lg:hidden w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
      >
        <Menu size={18} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-[88vw] max-w-[340px] bg-[var(--s1)]/95 backdrop-blur-md border-r border-[var(--border)] flex flex-col animate-step">
            <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                Documentación
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-3 py-5">
              <DocsSidebar onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
