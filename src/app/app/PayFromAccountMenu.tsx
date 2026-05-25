'use client'

import { useEffect, useRef, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'

interface AccountOption {
  id: string
  name: string
}

interface Props {
  accounts: AccountOption[]
  /** Fired when the user picks an account from the menu — receives
   *  the chosen accountId. The parent typically opens a transaction
   *  form pre-filled with category + account so the user only has to
   *  type amount + payee. */
  onSelect: (accountId: string) => void
}

/**
 * Compact "Pagar desde…" trigger + dropdown of accounts. Renders as a
 * small ghost button that fits next to a category row. Clicking opens
 * a panel listing every active account; selecting one fires onSelect
 * and closes the menu.
 */
export function PayFromAccountMenu({ accounts, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (accounts.length === 0) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Pagar desde una cuenta"
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-[var(--overlay-1)] hover:bg-[var(--overlay-2)] text-[var(--text2)] hover:text-[var(--brand-text)] text-eyebrow font-semibold uppercase tracking-[0.10em] transition-colors"
      >
        <Wallet size={11} strokeWidth={2.4} />
        Pagar
        <ChevronDown
          size={10}
          strokeWidth={2.4}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[200px] max-w-[260px] rounded-xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden animate-step"
        >
          <div className="px-3 pt-2.5 pb-1.5 text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
            Pagar desde
          </div>
          <ul className="max-h-[240px] overflow-y-auto">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    onSelect(a.id)
                  }}
                  className="w-full text-left px-3 py-2 text-body-sm text-[var(--text)] hover:bg-[var(--overlay-1)] hover:text-[var(--brand-text)] transition-colors"
                >
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
