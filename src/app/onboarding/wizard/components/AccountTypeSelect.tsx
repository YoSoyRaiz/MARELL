'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { AccountType } from '../types'

type Group = {
  title: string
  description: string
  types: { id: AccountType; label: string }[]
}

const TREE: Group[] = [
  {
    title: 'Efectivo',
    description: 'Dinero que ya tienes y puedes gastar.',
    types: [
      { id: 'checking', label: 'Cuenta corriente' },
      { id: 'savings', label: 'Cuenta de ahorros' },
      { id: 'cash', label: 'Efectivo en mano' },
    ],
  },
  {
    title: 'Crédito',
    description: 'Dinero prestado que pagas después, normalmente con interés.',
    types: [
      { id: 'credit_card', label: 'Tarjeta de crédito' },
      { id: 'line_of_credit', label: 'Línea de crédito' },
    ],
  },
  {
    title: 'Hipotecas y préstamos',
    description: 'Deudas con balance pendiente que estás pagando.',
    types: [
      { id: 'mortgage', label: 'Hipoteca' },
      { id: 'auto_loan', label: 'Préstamo de auto' },
      { id: 'student_loan', label: 'Préstamo estudiantil' },
      { id: 'personal_loan', label: 'Préstamo personal' },
      { id: 'medical_debt', label: 'Deuda médica' },
      { id: 'other_debt', label: 'Otra deuda' },
    ],
  },
  {
    title: 'Seguimiento',
    description: 'Cuentas que no piensas gastar pronto: inversiones o pasivos.',
    types: [
      { id: 'asset', label: 'Activo (ej. inversión)' },
      { id: 'liability', label: 'Pasivo' },
    ],
  },
]

export function labelForAccountType(type: AccountType): string {
  for (const g of TREE) {
    const t = g.types.find((tt) => tt.id === type)
    if (t) return t.label
  }
  return ''
}

interface AccountTypeSelectProps {
  value: AccountType | null
  onChange: (value: AccountType) => void
}

export function AccountTypeSelect({ value, onChange }: AccountTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full text-left px-4 py-3.5 rounded-xl border bg-[var(--s1)] flex items-center justify-between gap-2 transition-colors ${
          open
            ? 'border-[var(--brand-2)] shadow-[0_0_0_4px_rgba(61,220,151,0.10)]'
            : 'border-[var(--border2)] hover:border-[var(--border3)]'
        }`}
      >
        <span className={value ? 'text-[var(--text)]' : 'text-[var(--muted)]'}>
          {value ? labelForAccountType(value) : 'Selecciona tipo de cuenta...'}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`text-[var(--text2)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-2 left-0 right-0 z-30 rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_8px_32px_rgba(0,0,0,.5)] overflow-hidden max-h-[400px] overflow-y-auto"
        >
          {TREE.map((g) => (
            <div key={g.title} className="border-b border-[var(--border)] last:border-b-0">
              <div className="px-4 pt-3 pb-2 bg-white/[0.02]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                  {g.title}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug">
                  {g.description}
                </div>
              </div>
              {g.types.map((t) => {
                const active = value === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(t.id)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-[rgba(61,220,151,0.08)] text-[var(--brand-2)] font-medium'
                        : 'text-[var(--text)] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span>{t.label}</span>
                    {active && <Check size={16} strokeWidth={2.4} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
