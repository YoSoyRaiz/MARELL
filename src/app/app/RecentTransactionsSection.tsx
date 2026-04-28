'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ArrowDownRight, Plus, Receipt } from 'lucide-react'
import { TransactionFormModal } from './transacciones/TransactionFormModal'

const fmtMoney = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `$${formatted}`
}

export interface RecentTxn {
  id: string
  date: string
  payee_name: string | null
  category_name: string | null
  amount: number
}

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface RecentTransactionsSectionProps {
  transactions: RecentTxn[]
  accounts: AccountOption[]
  categories: CategoryOption[]
}

export function RecentTransactionsSection({
  transactions,
  accounts,
  categories,
}: RecentTransactionsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const canAdd = accounts.length > 0

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Transacciones recientes
            </h2>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              Últimos movimientos del mes
            </p>
          </div>
          <Link
            href="/app/transacciones"
            className="text-[12px] text-[var(--brand-2)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            Ver todas <ArrowRight size={12} strokeWidth={2.4} />
          </Link>
        </header>

        {transactions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Receipt size={20} strokeWidth={2} />
            </div>
            <div className="text-[14px] text-[var(--text)] font-medium">
              Aún sin transacciones
            </div>
            <p className="text-[12px] text-[var(--muted)] max-w-xs mx-auto leading-relaxed">
              Cuando agregues tu primera transacción, aparecerá aquí con su categoría y fecha.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={!canAdd}
              className="inline-flex items-center gap-1.5 mt-2 h-9 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={14} strokeWidth={2.2} />
              Agregar transacción
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.map((t) => {
              const isIncome = t.amount > 0
              return (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-[var(--text2)] shrink-0">
                    {isIncome ? (
                      <ArrowUpRight
                        size={16}
                        strokeWidth={2}
                        className="text-[var(--brand-2)]"
                      />
                    ) : (
                      <ArrowDownRight
                        size={16}
                        strokeWidth={2}
                        className="text-[var(--coral)]"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--text)] truncate">
                      {t.payee_name ?? 'Sin nombre'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">
                      {t.category_name ?? 'Sin categoría'} · {t.date}
                    </div>
                  </div>
                  <div
                    className={`text-[14px] tabular-nums num font-semibold ${
                      isIncome ? 'text-[var(--brand-2)]' : 'text-[var(--text)]'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {fmtMoney(Math.abs(t.amount))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        accounts={accounts}
        categories={categories}
        mode="add"
      />
    </>
  )
}
