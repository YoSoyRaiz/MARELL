'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  Upload,
  Receipt,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Split,
  X,
  CheckCircle2,
} from 'lucide-react'
import { iconForCategoryName } from '@/lib/categoryIcons'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { TransactionFormModal, type InitialTransaction } from './TransactionFormModal'
import { ImportTransactionsModal } from './ImportTransactionsModal'
import { BulkActionBar } from './BulkActionBar'
import { SHORTCUT_EVENTS } from '../KeyboardShortcuts'
import { deleteTransaction } from './actions'
import { useFormatMoney } from '../CurrencyProvider'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const formatMonthLabel = (month: string) => {
  if (month === 'all') return 'Todas las fechas'
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

const SHORT_MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const formatShortDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, , mm, dd] = m
  const monthIdx = parseInt(mm, 10) - 1
  return `${parseInt(dd, 10)} ${SHORT_MONTHS_ES[monthIdx] ?? ''}`.trim()
}

const adjustMonth = (month: string, delta: number) => {
  if (month === 'all') {
    // Coming back from "Todas": land on current month
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export type FilterType = 'all' | 'income' | 'expense'

export interface FilterState {
  month: string // YYYY-MM | 'all'
  type: FilterType
  q: string
}

export interface ListSubtransaction {
  id: string
  category_id: string | null
  category_name: string | null
  amount: number
  memo: string | null
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
  is_split: boolean
  is_transfer: boolean
  /** When is_transfer=true, the OTHER side's account id. */
  transfer_account_id: string | null
  receipt_url: string | null
  receipt_path: string | null
  subtransactions: ListSubtransaction[]
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
  filters: FilterState
}

const toInitial = (t: ListTransaction): InitialTransaction => {
  if (t.is_transfer) {
    // For transfer edits, treat the SOURCE leg (negative amount) as the
    // "from" so the form's accountId/toAccountId match user mental model.
    const isSource = t.amount < 0
    return {
      id: t.id,
      type: 'transfer',
      date: t.date,
      accountId: isSource ? t.account_id : (t.transfer_account_id ?? t.account_id),
      toAccountId: isSource ? (t.transfer_account_id ?? '') : t.account_id,
      categoryId: null,
      payeeName: t.payee_name ?? '',
      amount: Math.abs(t.amount),
      memo: t.memo,
    }
  }
  return {
    id: t.id,
    type: t.amount >= 0 ? 'income' : 'expense',
    date: t.date,
    accountId: t.account_id,
    categoryId: t.category_id,
    payeeName: t.payee_name ?? '',
    amount: Math.abs(t.amount),
    memo: t.memo,
    receiptUrl: t.receipt_url,
    receiptPath: t.receipt_path,
    splits:
      t.is_split && t.subtransactions.length >= 2
        ? t.subtransactions.map((s) => ({
            categoryId: s.category_id,
            amount: Math.abs(s.amount),
            memo: s.memo,
          }))
        : undefined,
  }
}

export function TransactionsClient({
  transactions,
  accounts,
  categories,
  hasBudget,
  filters,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const [navPending, startNav] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  // Tracks whether the open add-modal came from the mobile FAB. The
  // FAB version hides Categoría/Split/Memo to keep the form short;
  // the in-page "+ Agregar" button shows everything.
  const [addCompact, setAddCompact] = useState(false)
  // After-save toast. Holds the readable label like "Guardada el 27 abr"
  // for ~4s then auto-dismisses. Avoids forcing the user to a different
  // month filter — they can navigate themselves if they want to see the
  // row.
  const [savedToast, setSavedToast] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<ListTransaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startDelete] = useTransition()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // "n" anywhere on /transacciones opens a fresh new-transaction
  // modal. The keyboard shortcut is desktop-only by nature, so full
  // form (compact=false).
  useEffect(() => {
    const onNewKey = () => {
      setEditing(null)
      setAddCompact(false)
      setAddOpen(true)
    }
    window.addEventListener(SHORTCUT_EVENTS.newTransaction, onNewKey)
    return () => window.removeEventListener(SHORTCUT_EVENTS.newTransaction, onNewKey)
  }, [])

  // The mobile FAB navigates here with ?new=1 to open a fresh modal.
  // Strip the param after opening so refreshing the page doesn't
  // re-trigger the modal. FAB-triggered modals run in compact mode.
  useEffect(() => {
    if (searchParams?.get('new') !== '1') return
    setEditing(null)
    setAddCompact(true)
    setAddOpen(true)
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('new')
    const qs = sp.toString()
    router.replace(qs ? `/app/transacciones?${qs}` : '/app/transacciones')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Local search input that debounces into the URL
  const [searchInput, setSearchInput] = useState(filters.q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local input when the URL changes externally (e.g. browser back)
  useEffect(() => {
    setSearchInput(filters.q)
  }, [filters.q])

  // Debounced push of search input → URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const current = filters.q
    if (searchInput.trim() === current) return
    debounceRef.current = setTimeout(() => {
      pushParams({ q: searchInput.trim() || null })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Auto-dismiss the "Guardada · 27 abr" toast after 6 seconds.
  useEffect(() => {
    if (!savedToast) return
    const t = setTimeout(() => setSavedToast(null), 6000)
    return () => clearTimeout(t)
  }, [savedToast])

  const pushParams = (updates: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    startNav(() => {
      const qs = sp.toString()
      router.push(qs ? `/app/transacciones?${qs}` : '/app/transacciones')
    })
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar esta transacción?',
      description: 'Se revierte el monto en la cuenta. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    startDelete(async () => {
      await deleteTransaction(id)
      router.refresh()
      setDeletingId(null)
    })
  }

  const isEmpty = transactions.length === 0
  const filtersActive = !!filters.q || filters.type !== 'all' || filters.month === 'all'
  const modalOpen = addOpen || editing !== null
  const handleModalClose = () => {
    setAddOpen(false)
    setAddCompact(false)
    setEditing(null)
  }

  const clearFilters = () => {
    setSearchInput('')
    pushParams({ q: null, type: null, month: null })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Transacciones
            </div>
            <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
              Cada movimiento de tu <span className="gradient-text">dinero</span>.
            </h1>
            <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
              {isEmpty
                ? filtersActive
                  ? 'No hay transacciones que coincidan con los filtros actuales.'
                  : 'Aún no has agregado transacciones. Empieza con la primera.'
                : `${transactions.length} ${transactions.length === 1 ? 'movimiento' : 'movimientos'}. Click en una fila para editar.`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              disabled={!hasBudget || accounts.length === 0}
              className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-[12px] sm:text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] bg-white/[0.04] hover:bg-white/[0.08] inline-flex items-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Upload size={14} strokeWidth={2.2} />
              <span className="hidden sm:inline">Importar CSV</span>
              <span className="sm:hidden">Importar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddCompact(false)
                setAddOpen(true)
              }}
              disabled={!hasBudget || accounts.length === 0}
              className="h-10 sm:h-11 px-4 sm:px-5 gradient-bg text-[#0B0B0C] font-semibold text-[12px] sm:text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-1.5 sm:gap-2 transition-[filter] disabled:opacity-50 disabled:pointer-events-none flex-1 lg:flex-initial justify-center"
            >
              <Plus size={14} strokeWidth={2.4} />
              <span className="hidden sm:inline">Agregar transacción</span>
              <span className="sm:hidden">Agregar</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              size={14}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre del pagador..."
              className="w-full !h-10 !pl-10 !pr-10 !text-[13px] !rounded-xl"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.06] flex items-center justify-center transition-colors"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {/* Type pills */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'income', label: 'Ingresos' },
                { id: 'expense', label: 'Gastos' },
              ] as { id: FilterType; label: string }[]
            ).map((t) => {
              const active = filters.type === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pushParams({ type: t.id === 'all' ? null : t.id })}
                  className={`h-8 px-3 text-[12px] font-medium rounded-lg transition-colors ${
                    active
                      ? 'gradient-bg text-[#0B0B0C]'
                      : 'text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => pushParams({ month: adjustMonth(filters.month, -1) })}
              aria-label="Mes anterior"
              className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() =>
                pushParams({ month: filters.month === 'all' ? null : 'all' })
              }
              className="h-9 px-3 text-[13px] font-medium tabular-nums rounded-lg hover:bg-white/[0.04] text-[var(--text)] transition-colors min-w-[140px]"
            >
              {formatMonthLabel(filters.month)}
            </button>
            <button
              type="button"
              onClick={() => pushParams({ month: adjustMonth(filters.month, 1) })}
              aria-label="Mes siguiente"
              disabled={filters.month === 'all'}
              className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[12px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline px-2 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Empty state */}
        {isEmpty && !filtersActive && (
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
              onClick={() => {
                setAddCompact(false)
                setAddOpen(true)
              }}
              disabled={!hasBudget || accounts.length === 0}
              className="inline-flex items-center gap-1.5 mt-2 h-10 px-5 rounded-xl gradient-bg text-[#0B0B0C] font-semibold text-[13px] glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-[filter]"
            >
              <Plus size={14} strokeWidth={2.4} />
              Agregar la primera
            </button>
          </div>
        )}

        {/* Empty filtered state */}
        {isEmpty && filtersActive && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[var(--text2)]">
              <Search size={20} strokeWidth={2} />
            </div>
            <div className="text-[14px] text-[var(--text)] font-medium">
              Sin resultados
            </div>
            <p className="text-[12px] text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
              No hay transacciones que coincidan con los filtros. Prueba ampliar el rango o
              limpiar la búsqueda.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 mt-1 h-9 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] text-[13px] font-medium transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* List */}
        {!isEmpty && (
          <div
            className={`rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden transition-opacity duration-200 ${
              navPending ? 'opacity-60' : ''
            }`}
          >
            <div className="hidden md:grid grid-cols-[28px_80px_1fr_180px_180px_120px_40px] gap-4 px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)] items-center">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (selected.size === transactions.length && transactions.length > 0) {
                      clearSelection()
                    } else {
                      setSelected(new Set(transactions.map((t) => t.id)))
                    }
                  }}
                  aria-label="Seleccionar todas"
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                    transactions.length > 0 && selected.size === transactions.length
                      ? 'gradient-bg border-transparent'
                      : 'border-[var(--border2)] hover:border-[var(--brand-2)]'
                  }`}
                >
                  {transactions.length > 0 && selected.size === transactions.length && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </div>
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
                const isExpanded = expanded.has(t.id)
                return (
                  <li key={t.id} className={dimmed}>
                    {/* Mobile card layout (<md) */}
                    <div
                      onClick={() => setEditing(t)}
                      className={`md:hidden flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        selected.has(t.id) ? 'bg-[rgba(61,220,151,0.04)]' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelected(t.id)
                        }}
                        aria-label={selected.has(t.id) ? 'Quitar selección' : 'Seleccionar'}
                        aria-pressed={selected.has(t.id)}
                        className={`w-5 h-5 mt-1 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected.has(t.id)
                            ? 'gradient-bg border-transparent'
                            : 'border-[var(--border2)] hover:border-[var(--brand-2)]'
                        }`}
                      >
                        {selected.has(t.id) && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                        {t.is_transfer ? (
                          <ArrowLeftRight size={15} strokeWidth={2} className="text-[var(--info)]" />
                        ) : isIncome ? (
                          <ArrowUpRight size={15} strokeWidth={2} className="text-[var(--brand-2)]" />
                        ) : (
                          <ArrowDownRight size={15} strokeWidth={2} className="text-[var(--coral)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[14px] text-[var(--text)] font-medium truncate">
                            {t.payee_name ?? 'Sin nombre'}
                          </div>
                          <div
                            className={`text-[14px] tabular-nums num font-semibold whitespace-nowrap ${
                              isIncome ? 'text-[var(--brand-2)]' : 'text-[var(--text)]'
                            }`}
                          >
                            {isIncome ? '+' : '−'}
                            {fmtMoney(t.amount)}
                          </div>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                          <span className="tabular-nums num shrink-0">{formatDate(t.date)}</span>
                          <span className="text-[var(--muted2)]">·</span>
                          {t.is_split ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(t.id)
                              }}
                              className="inline-flex items-center gap-1 text-[var(--brand-2)]"
                              aria-expanded={isExpanded}
                            >
                              <Split size={10} strokeWidth={2.2} />
                              <span>{t.subtransactions.length} categorías</span>
                              <ChevronDown
                                size={10}
                                strokeWidth={2.4}
                                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                          ) : (
                            <span className="truncate">
                              {t.category_name ?? 'Sin categoría'}
                            </span>
                          )}
                          <span className="text-[var(--muted2)]">·</span>
                          <span className="truncate">{t.account_name}</span>
                        </div>
                        {t.memo && (
                          <div className="mt-1 text-[11px] text-[var(--muted)] truncate">{t.memo}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(t.id)
                        }}
                        aria-label="Eliminar transacción"
                        className="text-[var(--muted)] hover:text-[var(--coral)] p-1.5 -mr-1 rounded-lg hover:bg-white/[0.04] transition-colors shrink-0"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>

                    {/* Desktop table row (md+) */}
                    <div
                      onClick={() => setEditing(t)}
                      className={`hidden md:grid grid-cols-[28px_80px_1fr_180px_180px_120px_40px] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        selected.has(t.id) ? 'bg-[rgba(61,220,151,0.04)]' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelected(t.id)
                        }}
                        aria-label={selected.has(t.id) ? 'Quitar selección' : 'Seleccionar'}
                        aria-pressed={selected.has(t.id)}
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                          selected.has(t.id)
                            ? 'gradient-bg border-transparent'
                            : 'border-[var(--border2)] hover:border-[var(--brand-2)]'
                        }`}
                      >
                        {selected.has(t.id) && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="text-[12px] text-[var(--muted)] tabular-nums num">
                        {formatDate(t.date)}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                          {t.is_transfer ? (
                            <ArrowLeftRight size={14} strokeWidth={2} className="text-[var(--info)]" />
                          ) : isIncome ? (
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
                        {t.is_split ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(t.id)
                            }}
                            className="inline-flex items-center gap-1.5 text-[var(--brand-2)] hover:text-[var(--text)] transition-colors"
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Ocultar splits' : 'Ver splits'}
                          >
                            <Split size={12} strokeWidth={2.2} />
                            <span>{t.subtransactions.length} categorías</span>
                            <ChevronDown
                              size={12}
                              strokeWidth={2.4}
                              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        ) : (
                          <>
                            {Icon && <Icon size={13} strokeWidth={2} className="shrink-0" />}
                            <span className="truncate">{t.category_name ?? 'Sin categoría'}</span>
                          </>
                        )}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(t.id)
                        }}
                        aria-label="Eliminar transacción"
                        className="text-[var(--muted)] hover:text-[var(--coral)] p-2 rounded-lg hover:bg-white/[0.04] transition-colors justify-self-end"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>

                    {t.is_split && isExpanded && (
                      <div className="bg-[var(--bg)]/40 border-t border-[var(--border)] px-4 md:px-5 py-2">
                        <ul className="divide-y divide-[var(--border)]">
                          {t.subtransactions.map((s) => {
                            const SubIcon = s.category_name
                              ? iconForCategoryName(s.category_name)
                              : null
                            return (
                              <li key={s.id} className="py-2">
                                {/* Mobile: simple payee/amount row */}
                                <div className="md:hidden flex items-center gap-2 pl-9">
                                  <span className="text-[var(--muted2)] text-[12px]">↳</span>
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0 text-[12px] text-[var(--text2)]">
                                    {SubIcon && (
                                      <SubIcon size={11} strokeWidth={2} className="shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {s.category_name ?? 'Sin categoría'}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[12px] tabular-nums num font-medium whitespace-nowrap ${
                                      s.amount >= 0 ? 'text-[var(--brand-2)]' : 'text-[var(--text2)]'
                                    }`}
                                  >
                                    {s.amount >= 0 ? '+' : '−'}
                                    {fmtMoney(s.amount)}
                                  </div>
                                </div>

                                {/* Desktop: aligned table grid — leading
                                    empty cells reserve the checkbox + date
                                    columns. */}
                                <div className="hidden md:grid grid-cols-[28px_80px_1fr_180px_180px_120px_40px] gap-4 items-center">
                                  <div />
                                  <div />
                                  <div className="flex items-center gap-3 min-w-0 pl-11">
                                    <span className="text-[var(--muted2)] text-[14px]">↳</span>
                                    {s.memo && (
                                      <span className="text-[11px] text-[var(--muted)] truncate">
                                        {s.memo}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0 text-[12px] text-[var(--text2)]">
                                    {SubIcon && (
                                      <SubIcon size={12} strokeWidth={2} className="shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {s.category_name ?? 'Sin categoría'}
                                    </span>
                                  </div>
                                  <div />
                                  <div
                                    className={`text-right text-[12px] tabular-nums num ${
                                      s.amount >= 0 ? 'text-[var(--brand-2)]' : 'text-[var(--text2)]'
                                    }`}
                                  >
                                    {s.amount >= 0 ? '+' : '−'}
                                    {fmtMoney(s.amount)}
                                  </div>
                                  <div />
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        accounts={accounts}
        categories={categories}
        mode={editing ? 'edit' : 'add'}
        initial={editing ? toInitial(editing) : undefined}
        compactMobile={!editing && addCompact}
        onSaved={(savedDate) => {
          // Don't force a month switch — show a toast instead. The user
          // can navigate to the saved month manually if they want to
          // see the row right now.
          setSavedToast(`Guardada · ${formatShortDate(savedDate)}`)
        }}
      />

      <ImportTransactionsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        categories={categories}
      />

      {selected.size > 0 && (
        <BulkActionBar
          ids={Array.from(selected)}
          categories={categories}
          onClear={clearSelection}
        />
      )}

      {/* Save confirmation toast — centered on screen, large enough to
          read at a glance. Auto-dismisses after 6s. */}
      {savedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-7 py-5 rounded-3xl border border-[var(--brand-2)]/40 bg-[var(--s1)]/95 backdrop-blur-md shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-step inline-flex items-center gap-3 max-w-[90vw] pointer-events-none"
        >
          <CheckCircle2
            size={28}
            strokeWidth={2.2}
            className="text-[var(--brand-2)] shrink-0"
          />
          <span className="text-[18px] sm:text-[20px] font-bold text-[var(--text)] tracking-tight">
            {savedToast}
          </span>
        </div>
      )}
    </>
  )
}
