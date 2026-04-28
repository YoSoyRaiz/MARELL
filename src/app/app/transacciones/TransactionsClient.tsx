'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Receipt, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { AddTransactionModal } from './AddTransactionModal'
import { deleteTransaction } from './actions'

const fmtMoney = (n: number) => {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `$${formatted}`
}

const formatDate = (iso: string) => {
  // YYYY-MM-DD → DD MMM
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`
}

export interface ListTransaction {
  id: string
  date: string
  payee_name: string | null
  category_id: string | null
  category_name: string | null
  account_id: string
  account_name: string
  amount: number
  memo: string | null
}

export interface AccountOption {
  id: string
  name: string
}

export interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface Props {
  transactions: ListTransaction[]
  accounts: AccountOption[]
  categories: CategoryOption[]
  hasBudget: boolean
}

export function TransactionsClient({ transactions, accounts, categories, hasBudget }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startDelete] = useTransition()

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar esta transacción? Esto revierte el monto en la cuenta.')) {
      return
    }
    setDeletingId(id)
    startDelete(async () => {
      await deleteTransaction(id)
      router.refresh()
      setDeletingId(null)
    })
  }

  const isEmpty = transactions.length === 0

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Transacciones
            </div>
            <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
              Cada movimiento de tu <span className="gradient-text">dinero</span>.
            </h1>
            <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
              {transactions.length === 0
                ? 'Aún no has agregado transacciones. Empieza con la primera.'
                : `${transactions.length} ${transactions.length === 1 ? 'movimiento registrado' : 'movimientos registrados'}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!hasBudget || accounts.length === 0}
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus size={14} strokeWidth={2.4} />
            Agregar transacción
          </button>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Receipt size={22} strokeWidth={2} />
            </div>
            <div className="text-[16px] text-[var(--text)] font-semibold">
              Aún sin transacciones
            </div>
            <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Cuando agregues una, aparecerá aquí con su categoría, cuenta, fecha y monto.
              También va a alimentar la columna <span className="text-[var(--text)] font-medium">Actividad</span> de tu plan.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={!hasBudget || accounts.length === 0}
              className="inline-flex items-center gap-1.5 mt-2 h-10 px-5 rounded-xl gradient-bg text-[#0B0B0C] font-semibold text-[13px] glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-[filter]"
            >
              <Plus size={14} strokeWidth={2.4} />
              Agregar la primera
            </button>
          </div>
        )}

        {/* List */}
        {!isEmpty && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[80px_1fr_180px_180px_120px_40px] gap-4 px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
              <div>Fecha</div>
              <div>Pagado a</div>
              <div>Categoría</div>
              <div>Cuenta</div>
              <div className="text-right">Monto</div>
              <div></div>
            </div>

            <ul className="divide-y divide-[var(--border)]">
              {transactions.map((t) => {
                const isIncome = t.amount > 0
                const Icon = t.category_name ? iconForCategoryName(t.category_name) : null
                const dimmed = deletingId === t.id ? 'opacity-50 pointer-events-none' : ''
                return (
                  <li
                    key={t.id}
                    className={`grid grid-cols-[80px_1fr_180px_180px_120px_40px] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors ${dimmed}`}
                  >
                    <div className="text-[12px] text-[var(--muted)] tabular-nums num">
                      {formatDate(t.date)}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                        {isIncome ? (
                          <ArrowUpRight size={14} strokeWidth={2} className="text-[var(--brand-2)]" />
                        ) : (
                          <ArrowDownRight size={14} strokeWidth={2} className="text-[var(--coral)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] text-[var(--text)] truncate">
                          {t.payee_name ?? 'Sin nombre'}
                        </div>
                        {t.memo && (
                          <div className="text-[11px] text-[var(--muted)] truncate">{t.memo}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 text-[13px] text-[var(--text2)]">
                      {Icon && <Icon size={13} strokeWidth={2} className="shrink-0" />}
                      <span className="truncate">{t.category_name ?? 'Sin categoría'}</span>
                    </div>
                    <div className="text-[13px] text-[var(--text2)] truncate">{t.account_name}</div>
                    <div
                      className={`text-right text-[14px] tabular-nums num font-semibold ${
                        isIncome ? 'text-[var(--brand-2)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {isIncome ? '+' : '−'}
                      {fmtMoney(t.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      aria-label="Eliminar transacción"
                      className="text-[var(--muted)] hover:text-[var(--coral)] p-2 rounded-lg hover:bg-white/[0.04] transition-colors justify-self-end"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <AddTransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}
