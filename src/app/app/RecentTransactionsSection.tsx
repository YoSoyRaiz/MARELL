'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Receipt,
  Upload,
} from 'lucide-react'
import { TransactionFormModal } from './transacciones/TransactionFormModal'
import { ImportTransactionsModal } from './transacciones/ImportTransactionsModal'
import { SHORTCUT_EVENTS } from './KeyboardShortcuts'
import { useFormatMoney } from './CurrencyProvider'
import { Card } from '@/components/ui/Card'
import { CardHeader } from '@/components/ui/CardHeader'

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
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const canAdd = accounts.length > 0
  const fmtMoney = useFormatMoney()

  // "n" anywhere on Resumen opens the new-transaction modal here.
  useEffect(() => {
    const onNewKey = () => {
      if (canAdd) setAddOpen(true)
    }
    window.addEventListener(SHORTCUT_EVENTS.newTransaction, onNewKey)
    return () => window.removeEventListener(SHORTCUT_EVENTS.newTransaction, onNewKey)
  }, [canAdd])

  return (
    <>
      <Card as="section" className="overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <h2 className="text-emph font-semibold text-[var(--text)]">
              Transacciones recientes
            </h2>
            <p className="text-meta text-[var(--muted)] mt-0.5">
              Últimos movimientos del mes
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              disabled={!canAdd}
              className="text-meta font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] inline-flex items-center gap-1.5 h-8 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Upload size={12} strokeWidth={2.2} />
              Importar
            </button>
            <Link
              href="/app/transacciones"
              className="text-meta text-[var(--brand-text)] font-medium hover:underline underline-offset-4 inline-flex items-center gap-1 px-2"
            >
              Ver todas <ArrowRight size={12} strokeWidth={2.4} />
            </Link>
          </div>
        </CardHeader>

        {transactions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--overlay-1)] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Receipt size={20} strokeWidth={2} />
            </div>
            <div className="text-body text-[var(--text)] font-medium">
              Aún sin transacciones
            </div>
            <p className="text-meta text-[var(--muted)] max-w-xs mx-auto leading-relaxed">
              Cuando agregues tu primera transacción, aparecerá aquí con su categoría y fecha.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                disabled={!canAdd}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text)] text-body-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus size={14} strokeWidth={2.2} />
                Agregar
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                disabled={!canAdd}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text)] text-body-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Upload size={14} strokeWidth={2.2} />
                Importar
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.map((t) => {
              const isIncome = t.amount > 0
              return (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] flex items-center justify-center text-[var(--text2)] shrink-0">
                    {isIncome ? (
                      <ArrowUpRight
                        size={16}
                        strokeWidth={2}
                        className="text-[var(--brand-text)]"
                      />
                    ) : (
                      <ArrowDownRight
                        size={16}
                        strokeWidth={2}
                        className="text-[var(--coral-text)]"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-[var(--text)] truncate">
                      {t.payee_name ?? 'Sin nombre'}
                    </div>
                    <div className="text-eyebrow text-[var(--muted)] truncate">
                      {t.category_name ?? 'Sin categoría'} · {t.date}
                    </div>
                  </div>
                  <div
                    className={`text-body tabular-nums num font-semibold ${
                      isIncome ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
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
      </Card>

      <TransactionFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        accounts={accounts}
        categories={categories}
        mode="add"
      />

      <ImportTransactionsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}
