'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { generateCategories } from '../categoryGenerator'

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function Step23ZeroBased() {
  const answers = useOnboardingStore((s) => s.answers)

  const groups = useMemo(() => generateCategories(answers), [answers])
  const totalCategories = groups.reduce((s, g) => s + g.items.length, 0)

  const assignableCash = answers.accounts
    .filter((a) => {
      if (a.type === 'checking' || a.type === 'cash') return true
      if (a.type === 'savings' && !answers.savingsAside[a.id]) return true
      return false
    })
    .reduce((s, a) => s + a.balance, 0)

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          Cada peso tiene su <span className="gradient-text">lugar</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          Tienes dinero esperando trabajo y categorías listas para darlo. En un momento vas a
          asignar cada peso desde tu plan — a tu ritmo, no en el wizard.
        </p>
      </div>

      {/* Hero: Por asignar */}
      <div className="rounded-2xl border-2 border-[var(--brand-2)]/40 bg-[rgba(61,220,151,0.04)] px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--brand-2)]">
              Por asignar
            </div>
            <div className="text-[13px] text-[var(--text2)] mt-1 max-w-md">
              Listo para tu plan. Vas a asignar categoría por categoría cuando llegues al
              dashboard.
            </div>
          </div>
          <div className="text-[34px] sm:text-[42px] font-bold tabular-nums num gradient-text shrink-0">
            {fmtMoney(assignableCash)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4">
          <div className="text-[11px] text-[var(--brand-2)] uppercase tracking-[0.18em] font-semibold">
            Categorías
          </div>
          <div className="text-[26px] font-bold tabular-nums num text-[var(--text)] mt-1">
            {totalCategories}
          </div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">
            listas para recibir tu dinero
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4">
          <div className="text-[11px] text-[var(--brand-2)] uppercase tracking-[0.18em] font-semibold">
            Cuentas
          </div>
          <div className="text-[26px] font-bold tabular-nums num text-[var(--text)] mt-1">
            {answers.accounts.length}
          </div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">agregadas a tu plan</div>
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 flex gap-4">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-[#0B0B0C] shrink-0">
          <Sparkles size={18} strokeWidth={2.4} />
        </div>
        <div className="text-[13px] text-[var(--text2)] leading-relaxed">
          <span className="text-[var(--text)] font-semibold">Cómo funciona en tu plan:</span> cada
          categoría tendrá un botón <span className="text-[var(--text)] font-medium">Asignar</span>.
          Mueves dinero hasta que <span className="num text-[var(--text)] font-medium">Por asignar</span> llegue
          a $0. La gracia es que lo haces a tu ritmo — no tienes que terminar todo ahora.
        </div>
      </div>
    </div>
  )
}
