'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Wallet,
  CreditCard,
  Home,
  TrendingUp,
  Archive,
  Scale,
  Unlock,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { unreconcileAccount } from './actions'
import { ReconcileModal } from './ReconcileModal'
import type { LucideIcon } from 'lucide-react'
import {
  accountCategoryFromType,
  type AccountType,
  type AccountCategory,
} from '@/app/onboarding/wizard/types'
import { labelForAccountType } from '@/app/onboarding/wizard/components/AccountTypeSelect'
import { AccountFormModal, type InitialAccount } from './AccountFormModal'
import { useFormatMoney } from '../CurrencyProvider'

export interface ListAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  note: string | null
  closed: boolean
}

interface CategoryBlock {
  key: AccountCategory
  label: string
  Icon: LucideIcon
  hint: string
}

const CATEGORY_BLOCKS: CategoryBlock[] = [
  { key: 'cash', label: 'Efectivo', Icon: Wallet, hint: 'Dinero disponible para gastar' },
  { key: 'credit', label: 'Crédito', Icon: CreditCard, hint: 'Líneas y tarjetas que pagas después' },
  { key: 'loan', label: 'Hipotecas y préstamos', Icon: Home, hint: 'Deudas con balance pendiente' },
  { key: 'tracking', label: 'Seguimiento', Icon: TrendingUp, hint: 'Inversiones y pasivos no presupuestados' },
]

interface Props {
  accounts: ListAccount[]
  hasBudget: boolean
}

export function CuentasClient({ accounts, hasBudget }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [, startUnreconcile] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ListAccount | null>(null)
  const [reconciling, setReconciling] = useState<ListAccount | null>(null)
  const fmtMoney = useFormatMoney()

  const handleUnreconcile = async (a: ListAccount) => {
    const ok = await confirm({
      title: `¿Desreconciliar ${a.name}?`,
      description:
        'Pasamos cada transacción reconciliada a "cleared" para que las puedas editar otra vez. El ajuste de reconciliación no se borra automáticamente — bórralo a mano si la última reconciliación fue un error.',
      confirmLabel: 'Desreconciliar',
      tone: 'danger',
    })
    if (!ok) return
    startUnreconcile(async () => {
      await unreconcileAccount(a.id)
      router.refresh()
    })
  }

  const grouped = CATEGORY_BLOCKS.map((block) => ({
    ...block,
    items: accounts.filter((a) => accountCategoryFromType(a.type) === block.key),
  }))

  const totalCash = accounts
    .filter((a) => accountCategoryFromType(a.type) === 'cash' && !a.closed)
    .reduce((s, a) => s + a.balance, 0)
  const totalDebt = accounts
    .filter(
      (a) =>
        (accountCategoryFromType(a.type) === 'credit' ||
          accountCategoryFromType(a.type) === 'loan') &&
        !a.closed,
    )
    .reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalAssets = accounts
    .filter((a) => accountCategoryFromType(a.type) === 'tracking' && !a.closed)
    .reduce((s, a) => s + a.balance, 0)
  const netWorth = totalCash + totalAssets - totalDebt

  const isEmpty = accounts.length === 0

  return (
    <>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Cuentas
            </div>
            <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
              Todo tu <span className="gradient-text">dinero</span>, en un mapa.
            </h1>
            <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
              {isEmpty
                ? 'Aún no tienes cuentas. Agrega la primera para empezar.'
                : `${accounts.length} ${accounts.length === 1 ? 'cuenta' : 'cuentas'}. Click en una para editarla.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!hasBudget}
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] shrink-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus size={14} strokeWidth={2.4} />
            Agregar cuenta
          </button>
        </div>

        {/* Net worth summary */}
        {!isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Disponible" value={totalCash} positive />
            <SummaryCard label="Inversiones" value={totalAssets} positive />
            <SummaryCard label="Deudas" value={-totalDebt} />
            <SummaryCard label="Patrimonio neto" value={netWorth} highlight />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Wallet size={22} strokeWidth={2} />
            </div>
            <div className="text-[16px] text-[var(--text)] font-semibold">
              Aún sin cuentas
            </div>
            <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Agrega tus cuentas corriente, ahorros, tarjetas y préstamos. El tipo determina cómo
              se calcula tu patrimonio neto.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!hasBudget}
              className="inline-flex items-center gap-1.5 mt-2 h-10 px-5 rounded-xl gradient-bg text-[#0B0B0C] font-semibold text-[13px] glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-[filter]"
            >
              <Plus size={14} strokeWidth={2.4} />
              Agregar la primera
            </button>
          </div>
        )}

        {/* Groups */}
        {!isEmpty && (
          <div className="space-y-4">
            {grouped
              .filter((g) => g.items.length > 0)
              .map((g) => {
                const groupTotal = g.items
                  .filter((a) => !a.closed)
                  .reduce(
                    (s, a) =>
                      s + (g.key === 'credit' || g.key === 'loan' ? Math.abs(a.balance) : a.balance),
                    0,
                  )
                const totalLabel =
                  g.key === 'credit' || g.key === 'loan'
                    ? `−${fmtMoney(groupTotal)}`
                    : fmtMoney(groupTotal)
                return (
                  <div
                    key={g.key}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden"
                  >
                    <header className="px-5 py-3 border-b border-[var(--border)] bg-white/[0.02] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white/[0.04] text-[var(--brand-2)] flex items-center justify-center shrink-0">
                          <g.Icon size={16} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                            {g.label}
                          </h3>
                          <p className="text-[11px] text-[var(--muted)] truncate">{g.hint}</p>
                        </div>
                      </div>
                      <div
                        className={`text-[14px] tabular-nums num font-semibold shrink-0 ${
                          g.key === 'credit' || g.key === 'loan'
                            ? 'text-[var(--coral)]'
                            : 'text-[var(--text)]'
                        }`}
                      >
                        {totalLabel}
                      </div>
                    </header>
                    <ul className="divide-y divide-[var(--border)]">
                      {g.items.map((a) => {
                        const isDebt = g.key === 'credit' || g.key === 'loan'
                        const cashTypes = ['checking', 'savings', 'cash']
                        const debtTypes = [
                          'credit_card',
                          'line_of_credit',
                          'mortgage',
                          'auto_loan',
                          'student_loan',
                          'personal_loan',
                          'medical_debt',
                          'other_debt',
                        ]
                        const canReconcile =
                          !a.closed &&
                          (cashTypes.includes(a.type) || debtTypes.includes(a.type))
                        return (
                          <li
                            key={a.id}
                            onClick={() => setEditing(a)}
                            className={`px-5 py-3.5 flex items-center gap-4 cursor-pointer transition-colors ${
                              a.closed
                                ? 'opacity-50 hover:bg-white/[0.02]'
                                : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-lg bg-white/[0.04] text-[var(--text2)] flex items-center justify-center shrink-0">
                              <g.Icon size={14} strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[14px] text-[var(--text)] truncate flex items-center gap-2">
                                {a.name}
                                {a.closed && (
                                  <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted2)] inline-flex items-center gap-1">
                                    <Archive size={10} strokeWidth={2} />
                                    Cerrada
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--muted)] truncate">
                                {labelForAccountType(a.type)}
                                {a.note && <> · {a.note}</>}
                              </div>
                            </div>
                            {canReconcile && (
                              <div className="shrink-0 inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setReconciling(a)
                                  }}
                                  title="Reconciliar contra el banco"
                                  aria-label={`Reconciliar ${a.name}`}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text2)] hover:text-[var(--brand-2)] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
                                >
                                  <Scale size={12} strokeWidth={2.4} />
                                  <span className="hidden sm:inline">Reconciliar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnreconcile(a)
                                  }}
                                  title="Desreconciliar (deshacer la última reconciliación)"
                                  aria-label={`Desreconciliar ${a.name}`}
                                  className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[rgba(255,122,89,0.10)] inline-flex items-center justify-center transition-colors"
                                >
                                  <Unlock size={12} strokeWidth={2.4} />
                                </button>
                              </div>
                            )}
                            <div
                              className={`text-[15px] tabular-nums num font-semibold shrink-0 ${
                                isDebt
                                  ? 'text-[var(--coral)]'
                                  : a.balance < -0.005
                                    ? 'text-[var(--coral)]'
                                    : 'text-[var(--text)]'
                              }`}
                            >
                              {fmtMoney(a.balance)}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {reconciling && (
        <ReconcileModal
          isOpen={true}
          onClose={() => setReconciling(null)}
          accountId={reconciling.id}
          accountName={reconciling.name}
          currentBalance={reconciling.balance}
          isDebt={
            accountCategoryFromType(reconciling.type) === 'credit' ||
            accountCategoryFromType(reconciling.type) === 'loan'
          }
        />
      )}

      <AccountFormModal
        isOpen={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false)
          setEditing(null)
        }}
        mode={editing ? 'edit' : 'add'}
        initial={
          editing
            ? ({
                id: editing.id,
                name: editing.name,
                type: editing.type,
                balance: editing.balance,
                note: editing.note,
                closed: editing.closed,
              } satisfies InitialAccount)
            : undefined
        }
      />
    </>
  )
}

function SummaryCard({
  label,
  value,
  positive,
  highlight,
}: {
  label: string
  value: number
  positive?: boolean
  highlight?: boolean
}) {
  const fmtMoney = useFormatMoney()
  const color =
    value < -0.005
      ? 'text-[var(--coral)]'
      : highlight
        ? 'gradient-text'
        : positive
          ? 'text-[var(--text)]'
          : 'text-[var(--text)]'

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold">
        {label}
      </div>
      <div className={`text-[22px] font-bold tabular-nums num leading-none mt-2 ${color}`}>
        {fmtMoney(value)}
      </div>
    </div>
  )
}
