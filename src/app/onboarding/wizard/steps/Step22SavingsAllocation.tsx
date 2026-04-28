'use client'

import { PiggyBank } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { accountCategoryFromType } from '../types'

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function Step22SavingsAllocation() {
  const accounts = useOnboardingStore((s) => s.answers.accounts)
  const savingsAside = useOnboardingStore((s) => s.answers.savingsAside)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  const savingsAccounts = accounts.filter((a) => a.type === 'savings')
  const totalSavings = savingsAccounts.reduce((s, a) => s + a.balance, 0)

  const setAside = (accountId: string, aside: boolean) => {
    setAnswer('savingsAside', { ...savingsAside, [accountId]: aside })
  }

  if (savingsAccounts.length === 0) {
    return (
      <div className="space-y-7">
        <div className="space-y-3">
          <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
            Sin cuentas de <span className="gradient-text">ahorros</span>.
          </h1>
          <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
            Está bien — sigamos al siguiente paso para asignar tu dinero.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          Tus cuentas de <span className="gradient-text">ahorros</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Tienes <span className="text-[var(--text)] font-semibold num">{fmtMoney(totalSavings)}</span> en
          ahorros. ¿Quieres usarlos en tu plan o prefieres dejarlos apartados como colchón?
        </p>
      </div>

      <div className="space-y-3">
        {savingsAccounts.map((a) => {
          const aside = savingsAside[a.id] ?? false
          return (
            <div
              key={a.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] text-[var(--text2)] flex items-center justify-center shrink-0">
                    <PiggyBank size={20} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-[var(--text)] truncate">{a.name}</div>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">Cuenta de ahorros</div>
                  </div>
                </div>
                <div className="text-[18px] font-bold tabular-nums num text-[var(--text)] shrink-0">
                  {fmtMoney(a.balance)}
                </div>
              </div>

              {/* Segmented control */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setAside(a.id, false)}
                  className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                    !aside
                      ? 'gradient-bg text-[#0B0B0C]'
                      : 'text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  Usar en el plan
                </button>
                <button
                  type="button"
                  onClick={() => setAside(a.id, true)}
                  className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                    aside
                      ? 'bg-white/[0.08] text-[var(--text)]'
                      : 'text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  Apartar por ahora
                </button>
              </div>

              <p className="text-[12px] text-[var(--muted)] leading-relaxed">
                {aside
                  ? 'Este dinero queda como colchón — no se reparte entre categorías.'
                  : 'Este dinero se suma a lo disponible para asignar.'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
