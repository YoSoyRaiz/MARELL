'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Search, User, Users } from 'lucide-react'
import { setActiveBudget } from '@/lib/budget/actions'
import type { UserBudgetListItem } from '@/lib/budget/active'

interface Props {
  budgets: UserBudgetListItem[]
  activeBudgetId: string | null
}

/**
 * Selector de budget en el TopBar.
 *
 * Comportamiento por cantidad de budgets:
 *   • 0: no se renderiza (usuario sin onboarding)
 *   • 1: muestra el nombre como texto plano sin dropdown
 *     (preserva UX para 99% de usuarios single-budget)
 *   • 2-5: dropdown simple
 *   • 6+: dropdown con input de búsqueda al tope (escala a N grande)
 *
 * Los budgets se agrupan por relación: "Mis presupuestos" (owner) y
 * "Clientes" (auditor/editor/viewer). Esto permite al auditor
 * encontrar rápido sus propios budgets vs los de sus clientes.
 */
export function BudgetSwitcher({ budgets, activeBudgetId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Cierra al click fuera
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Atajo Cmd+K para abrir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => {
          const next = !v
          if (next) setTimeout(() => searchRef.current?.focus(), 50)
          return next
        })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (budgets.length === 0) return null

  const active = budgets.find((b) => b.id === activeBudgetId) ?? budgets[0]

  // Single-budget: texto plano sin chrome
  if (budgets.length === 1) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 text-body-sm font-semibold text-[var(--text)]">
        <User size={13} strokeWidth={2.2} className="text-[var(--muted)]" />
        <span className="truncate max-w-[180px]">{active.name}</span>
      </div>
    )
  }

  // Filtra por query (normalizada sin acentos)
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const queryNorm = normalize(query.trim())
  const filtered = queryNorm
    ? budgets.filter((b) => normalize(b.name).includes(queryNorm))
    : budgets

  const own = filtered.filter((b) => b.isOwn)
  const shared = filtered.filter((b) => !b.isOwn)
  const showSearch = budgets.length >= 6

  const handleSelect = (id: string) => {
    if (id === active.id) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      await setActiveBudget(id)
      setOpen(false)
      setQuery('')
      router.refresh()
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next && showSearch) setTimeout(() => searchRef.current?.focus(), 50)
            return next
          })
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-body-sm font-semibold text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
      >
        {active.isOwn ? (
          <User size={13} strokeWidth={2.2} className="text-[var(--brand-text)]" />
        ) : (
          <Users size={13} strokeWidth={2.2} className="text-[var(--info-text)]" />
        )}
        <span className="truncate max-w-[180px]">{active.name}</span>
        <ChevronDown
          size={13}
          strokeWidth={2.2}
          className={`text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Seleccionar presupuesto"
          className="absolute left-0 top-full mt-1.5 z-50 w-[280px] rounded-xl border border-[var(--border2)] bg-[var(--s2)] shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-step"
        >
          {showSearch && (
            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
              <Search size={13} strokeWidth={2.2} className="text-[var(--muted)] shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar presupuesto…"
                autoComplete="off"
                className="flex-1 bg-transparent border-0 outline-none !text-body-sm !p-0 !rounded-none text-[var(--text)] placeholder:text-[var(--muted2)]"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setOpen(false)
                  }
                }}
              />
              <kbd className="text-tiny text-[var(--muted2)] uppercase tracking-[0.08em] font-mono">
                Esc
              </kbd>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-meta text-[var(--muted)] text-center">
                Sin resultados
              </div>
            ) : (
              <>
                {own.length > 0 && (
                  <BudgetGroup
                    label="Mis presupuestos"
                    items={own}
                    activeBudgetId={active.id}
                    onSelect={handleSelect}
                    pending={pending}
                  />
                )}
                {shared.length > 0 && (
                  <BudgetGroup
                    label={
                      shared.some((b) => b.role === 'auditor')
                        ? 'Clientes'
                        : 'Compartidos conmigo'
                    }
                    items={shared}
                    activeBudgetId={active.id}
                    onSelect={handleSelect}
                    pending={pending}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetGroup({
  label,
  items,
  activeBudgetId,
  onSelect,
  pending,
}: {
  label: string
  items: UserBudgetListItem[]
  activeBudgetId: string
  onSelect: (id: string) => void
  pending: boolean
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-tiny uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold">
        {label}
      </div>
      <ul>
        {items.map((b) => {
          const isActive = b.id === activeBudgetId
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                disabled={pending}
                role="option"
                aria-selected={isActive}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--overlay-2)]'
                    : 'hover:bg-[var(--overlay-1)]'
                } disabled:opacity-50 disabled:pointer-events-none`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm text-[var(--text)] truncate">
                    {b.name}
                  </div>
                  <div className="text-tiny text-[var(--muted)] truncate mt-0.5 capitalize">
                    {roleLabel(b.role)}
                    {b.currency && b.currency !== 'DOP' ? ` · ${b.currency}` : ''}
                  </div>
                </div>
                {isActive && (
                  <Check
                    size={14}
                    strokeWidth={2.4}
                    className="text-[var(--brand-text)] shrink-0"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function roleLabel(role: UserBudgetListItem['role']): string {
  switch (role) {
    case 'owner':
      return 'Propietario'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Solo lectura'
    case 'auditor':
      return 'Auditor'
  }
}
