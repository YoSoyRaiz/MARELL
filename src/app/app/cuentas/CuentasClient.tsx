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
  Pencil,
  ChevronDown,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { IconBadge } from '@/components/ui/IconBadge'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
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
import { AccountTransactionsDropdown } from './AccountTransactionsDropdown'
import { useFormatMoney } from '../CurrencyProvider'
import { AddTransactionButton } from '../AddTransactionButton'

export interface ListAccount {
  id: string
  name: string
  type: AccountType
  /** Balance in the account's native currency. Already signed
   *  (negative for debts). */
  balance: number
  note: string | null
  closed: boolean
  /** 'DOP' or 'USD'. USD balances are converted to DOP for totals. */
  currency: 'DOP' | 'USD'
  /** APR percent — credit cards / loans. */
  interestRateApr: number | null
  /** Day-of-month (1-31) — credit card statement close. */
  cycleCloseDay: number | null
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

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface Props {
  accounts: ListAccount[]
  /** Categorías (con grupo) para el modal in-place de
   *  "Agregar transacción" en el header. */
  categoryOptions: CategoryOption[]
  hasBudget: boolean
  /** Latest BCRD-published USD→DOP rate. Used to convert USD account
   *  balances into DOP for the totals shown in this view. */
  usdToDopRate: number
}

// Convert any account balance to DOP for total math. USD accounts use
// the supplied BCRD rate; DOP accounts pass through unchanged.
function toDop(amount: number, currency: 'DOP' | 'USD', rate: number): number {
  return currency === 'USD' ? amount * rate : amount
}

export function CuentasClient({
  accounts,
  categoryOptions,
  hasBudget,
  usdToDopRate,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [, startUnreconcile] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ListAccount | null>(null)
  const [reconciling, setReconciling] = useState<ListAccount | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  // All totals are computed in DOP — USD balances are converted using
  // the BCRD rate so the user sees a single consolidated number.
  const totalCash = accounts
    .filter((a) => accountCategoryFromType(a.type) === 'cash' && !a.closed)
    .reduce((s, a) => s + toDop(a.balance, a.currency, usdToDopRate), 0)
  const totalDebt = accounts
    .filter(
      (a) =>
        (accountCategoryFromType(a.type) === 'credit' ||
          accountCategoryFromType(a.type) === 'loan') &&
        !a.closed,
    )
    .reduce(
      (s, a) => s + Math.abs(toDop(a.balance, a.currency, usdToDopRate)),
      0,
    )
  const totalAssets = accounts
    .filter((a) => accountCategoryFromType(a.type) === 'tracking' && !a.closed)
    .reduce((s, a) => s + toDop(a.balance, a.currency, usdToDopRate), 0)
  const netWorth = totalCash + totalAssets - totalDebt

  const isEmpty = accounts.length === 0

  return (
    <>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PageHeader
              eyebrow="Cuentas"
              description={
                isEmpty
                  ? 'Aún no tienes cuentas. Agrega la primera para empezar.'
                  : `${accounts.length} ${accounts.length === 1 ? 'cuenta' : 'cuentas'}. Click en una para editarla.`
              }
            >
              Todo tu <span className="gradient-text">dinero</span>, en un mapa.
            </PageHeader>
          </div>
          {/* Dos CTAs en el header: agregar transacción (secundario,
              outlined) abre el modal in-place sin salir de Cuentas;
              agregar cuenta (primario, brand) abre el modal de cuenta. */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <AddTransactionButton
              accounts={accounts
                .filter((a) => !a.closed)
                .map((a) => ({ id: a.id, name: a.name }))}
              categories={categoryOptions}
              variant="outlined"
              disabled={!hasBudget}
            />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!hasBudget}
              className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={14} strokeWidth={2.4} />
              Agregar cuenta
            </button>
          </div>
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

        {isEmpty && (
          <EmptyState
            Icon={Wallet}
            title="Aún sin cuentas"
            description="Agrega tus cuentas corriente, ahorros, tarjetas y préstamos. El tipo determina cómo se calcula tu patrimonio neto."
            action={
              <Button
                size="tight"
                onClick={() => setAddOpen(true)}
                disabled={!hasBudget}
                iconLeft={<Plus size={14} strokeWidth={2.4} />}
              >
                Agregar la primera
              </Button>
            }
          />
        )}

        {/* Groups */}
        {!isEmpty && (
          <div className="space-y-4">
            {grouped
              .filter((g) => g.items.length > 0)
              .map((g) => {
                const groupTotal = g.items
                  .filter((a) => !a.closed)
                  .reduce((s, a) => {
                    const dop = toDop(a.balance, a.currency, usdToDopRate)
                    return (
                      s + (g.key === 'credit' || g.key === 'loan' ? Math.abs(dop) : dop)
                    )
                  }, 0)
                const totalLabel =
                  g.key === 'credit' || g.key === 'loan'
                    ? `−${fmtMoney(groupTotal)}`
                    : fmtMoney(groupTotal)
                return (
                  <Card key={g.key} className="overflow-hidden">
                    <header className="px-5 py-3 border-b border-[var(--border)] bg-[var(--overlay-1)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
                          <g.Icon size={16} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
                            {g.label}
                          </h3>
                          <p className="text-[11px] text-[var(--muted)] truncate">{g.hint}</p>
                        </div>
                      </div>
                      <div
                        className={`text-[14px] tabular-nums num font-semibold shrink-0 ${
                          g.key === 'credit' || g.key === 'loan'
                            ? 'text-[var(--coral-text)]'
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
                        const isExpanded = expandedId === a.id
                        // Show the account balance in its native currency.
                        // The header total above already aggregates in DOP.
                        const currencySymbol = a.currency === 'USD' ? 'US$' : 'RD$'
                        const balanceText = `${a.balance < 0 ? '−' : ''}${currencySymbol}${Math.abs(
                          a.balance,
                        ).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                        return (
                          <li key={a.id} className="contents">
                            <div
                              onClick={() =>
                                setExpandedId(isExpanded ? null : a.id)
                              }
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setExpandedId(isExpanded ? null : a.id)
                                }
                              }}
                              className={`px-5 py-3.5 flex items-center gap-4 cursor-pointer transition-colors ${
                                a.closed
                                  ? 'opacity-50 hover:bg-[var(--overlay-1)]'
                                  : 'hover:bg-[var(--overlay-1)]'
                              } ${isExpanded ? 'bg-[var(--overlay-1)]' : ''}`}
                            >
                              <IconBadge>
                                <g.Icon size={14} strokeWidth={2} />
                              </IconBadge>
                              <div className="flex-1 min-w-0">
                                <div className="text-[14px] text-[var(--text)] truncate flex items-center gap-2 flex-wrap">
                                  {a.name}
                                  {a.currency === 'USD' && (
                                    <span className="text-[9px] uppercase tracking-[0.15em] text-[var(--info-text)] bg-[rgba(77,168,255,0.12)] px-1.5 py-0.5 rounded">
                                      USD
                                    </span>
                                  )}
                                  {a.closed && (
                                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted2)] inline-flex items-center gap-1">
                                      <Archive size={10} strokeWidth={2} />
                                      Cerrada
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--muted)] truncate">
                                  {labelForAccountType(a.type)}
                                  {a.interestRateApr != null && <> · {a.interestRateApr.toFixed(2)}% APR</>}
                                  {a.cycleCloseDay != null && <> · corte día {a.cycleCloseDay}</>}
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
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text2)] hover:text-[var(--brand-text)] text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
                                  >
                                    <Scale size={12} strokeWidth={2.4} />
                                    <span className="hidden sm:inline">Reconciliar</span>
                                  </button>
                                  <IconButton
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnreconcile(a)
                                    }}
                                    title="Desreconciliar (deshacer la última reconciliación)"
                                    aria-label={`Desreconciliar ${a.name}`}
                                    inline
                                    size="sm"
                                    tone="danger"
                                  >
                                    <Unlock size={12} strokeWidth={2.4} />
                                  </IconButton>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditing(a)
                                }}
                                title="Editar cuenta"
                                aria-label={`Editar ${a.name}`}
                                className="shrink-0 w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--brand-text)] hover:bg-[var(--overlay-2)] inline-flex items-center justify-center transition-colors"
                              >
                                <Pencil size={12} strokeWidth={2.4} />
                              </button>
                              <div
                                className={`text-[15px] tabular-nums num font-semibold shrink-0 ${
                                  isDebt
                                    ? 'text-[var(--coral-text)]'
                                    : a.balance < -0.005
                                      ? 'text-[var(--coral-text)]'
                                      : 'text-[var(--text)]'
                                }`}
                              >
                                {balanceText}
                              </div>
                              <ChevronDown
                                size={14}
                                strokeWidth={2.2}
                                className={`shrink-0 text-[var(--muted)] transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                            <AccountTransactionsDropdown
                              accountId={a.id}
                              currency={a.currency}
                              open={isExpanded}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
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
                currency: editing.currency,
                interestRateApr: editing.interestRateApr,
                cycleCloseDay: editing.cycleCloseDay,
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
      ? 'text-[var(--coral-text)]'
      : highlight
        ? 'gradient-text'
        : positive
          ? 'text-[var(--text)]'
          : 'text-[var(--text)]'

  return (
    <Card padding="sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
        {label}
      </div>
      <div className={`text-[22px] font-bold tabular-nums num leading-none mt-2 ${color}`}>
        {fmtMoney(value)}
      </div>
    </Card>
  )
}
