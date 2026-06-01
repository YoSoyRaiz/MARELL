'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  ChevronRight,
  Plus,
  Search,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import { setActiveBudget } from '@/lib/budget/actions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFormatMoney } from '../CurrencyProvider'
import type { ClientDashboardRow } from './dashboard-action'

interface Props {
  rows: ClientDashboardRow[]
  totals: {
    clientCount: number
    netWorthSumDOP: number
    monthIncomeSumDOP: number
    monthExpenseSumDOP: number
    alertSum: number
  }
  canCreate: boolean
}

type SortMode = 'name' | 'netWorth' | 'recent' | 'alerts'

/**
 * Dashboard "Mis Clientes" — vista agregada del auditor.
 *
 * Diseño defensivo para N grande:
 *   - Búsqueda con normalización de acentos
 *   - Sort opciones (nombre / patrimonio / reciente / alertas)
 *   - Grid CSS responsive — no asume cantidad
 *   - Cards independientes — click cambia active budget y navega
 */
export function ClientesClient({ rows, totals, canCreate }: Props) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const q = normalize(query.trim())
    let r = q ? rows.filter((x) => normalize(x.clientLabel).includes(q)) : rows
    r = [...r]
    switch (sort) {
      case 'name':
        r.sort((a, b) => a.clientLabel.localeCompare(b.clientLabel, 'es'))
        break
      case 'netWorth':
        r.sort((a, b) => b.netWorthDOP - a.netWorthDOP)
        break
      case 'alerts':
        r.sort((a, b) => b.alertCount - a.alertCount)
        break
      case 'recent':
      default:
        r.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
    }
    return r
  }, [rows, query, sort])

  const openClient = (budgetId: string) => {
    startTransition(async () => {
      await setActiveBudget(budgetId)
      router.push('/app')
      router.refresh()
    })
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow="Clientes"
          description="Crea y administra los clientes que auditas. Cada uno tiene su propio login y solo ve su propio presupuesto."
        >
          Tus <span className="gradient-text">clientes</span>.
        </PageHeader>
        <EmptyState
          Icon={Building2}
          title="Aún no tienes clientes"
          description="Crea tu primer cliente para empezar. MARELL le envía un email con acceso y tú ves su data en read-only desde tu cuenta."
          action={
            canCreate ? (
              <Link
                href="/app/clientes/nuevo"
                className="inline-flex items-center gap-2 h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body-sm rounded-xl"
              >
                <Plus size={14} strokeWidth={2.4} />
                Crear primer cliente
              </Link>
            ) : null
          }
        />
      </div>
    )
  }

  return (
    <div className={`space-y-7 ${pending ? 'opacity-60' : ''} transition-opacity`}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <PageHeader
            eyebrow="Clientes"
            description={`${totals.clientCount} ${totals.clientCount === 1 ? 'cliente activo' : 'clientes activos'} bajo tu gestión.`}
          >
            Tus <span className="gradient-text">clientes</span>.
          </PageHeader>
        </div>
        {canCreate && (
          <Link
            href="/app/clientes/nuevo"
            className="h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body-sm rounded-xl inline-flex items-center gap-2 shrink-0"
          >
            <Plus size={14} strokeWidth={2.4} />
            Nuevo cliente
          </Link>
        )}
      </div>

      {/* Totales agregados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryStat
          label="Patrimonio combinado"
          value={fmtMoney(totals.netWorthSumDOP)}
          Icon={Wallet}
          tone={totals.netWorthSumDOP >= 0 ? 'brand' : 'coral'}
        />
        <SummaryStat
          label="Ingresos del mes"
          value={fmtMoney(totals.monthIncomeSumDOP)}
          Icon={ArrowUp}
          tone="brand"
        />
        <SummaryStat
          label="Gastos del mes"
          value={fmtMoney(totals.monthExpenseSumDOP)}
          Icon={ArrowDown}
          tone="coral"
        />
        <SummaryStat
          label="Con alertas"
          value={`${totals.alertSum}`}
          Icon={AlertTriangle}
          tone={totals.alertSum > 0 ? 'warn' : 'muted'}
        />
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full !h-10 !pl-10 !pr-3 !text-body-sm !rounded-xl"
          />
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-[var(--overlay-1)] rounded-xl">
          {(
            [
              { id: 'recent', label: 'Recientes' },
              { id: 'name', label: 'Nombre' },
              { id: 'netWorth', label: 'Patrimonio' },
              { id: 'alerts', label: 'Alertas' },
            ] as { id: SortMode; label: string }[]
          ).map((s) => {
            const isActive = sort === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`h-8 px-3 text-meta font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--s1)] text-[var(--text)] shadow-[inset_0_-2px_0_var(--brand-2)]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid de clientes */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-body-sm text-[var(--muted)]">
          Sin resultados para “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ClientCard
              key={c.agencyRelationshipId}
              row={c}
              fmtMoney={fmtMoney}
              onOpen={() => openClient(c.clientBudgetId)}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  Icon,
  tone,
}: {
  label: string
  value: string
  Icon: typeof Wallet
  tone: 'brand' | 'coral' | 'warn' | 'muted'
}) {
  const color = {
    brand: 'text-[var(--brand-text)]',
    coral: 'text-[var(--coral-text)]',
    warn: 'text-[var(--warn-text)]',
    muted: 'text-[var(--muted)]',
  }[tone]
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-eyebrow uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold truncate">
          {label}
        </span>
        <Icon size={14} strokeWidth={2.2} className={`shrink-0 ${color}`} />
      </div>
      <div className={`text-h2 sm:text-[22px] font-bold tabular-nums num leading-none ${color}`}>
        {value}
      </div>
    </section>
  )
}

function ClientCard({
  row,
  fmtMoney,
  onOpen,
  pending,
}: {
  row: ClientDashboardRow
  fmtMoney: (n: number) => string
  onOpen: () => void
  pending: boolean
}) {
  return (
    <Card className="overflow-hidden hover:border-[var(--brand-2)]/40 transition-colors">
      <button
        type="button"
        onClick={onOpen}
        disabled={pending}
        className="w-full text-left disabled:opacity-50 disabled:pointer-events-none"
      >
        <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-emph font-semibold text-[var(--text)] truncate">
              {row.clientLabel}
            </div>
            <div className="text-tiny text-[var(--muted)] mt-0.5 inline-flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  row.status === 'active'
                    ? 'bg-[var(--brand-2)]'
                    : 'bg-[var(--muted2)]'
                }`}
              />
              {row.status === 'active' ? 'Activo' : row.status}
              {row.alertCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-[var(--coral-text)] inline-flex items-center gap-1">
                    <AlertTriangle size={10} strokeWidth={2.4} />
                    {row.alertCount} {row.alertCount === 1 ? 'alerta' : 'alertas'}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight
            size={14}
            strokeWidth={2.2}
            className="text-[var(--muted2)] shrink-0"
          />
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3">
          <KpiCell
            label="Patrimonio"
            value={fmtMoney(row.netWorthDOP)}
            tone={row.netWorthDOP >= 0 ? 'brand' : 'coral'}
          />
          <KpiCell
            label="Ingresos mes"
            value={fmtMoney(row.monthIncomeDOP)}
            tone="brand"
          />
          <KpiCell
            label="Gastos mes"
            value={fmtMoney(row.monthExpenseDOP)}
            tone="coral"
          />
          <KpiCell
            label="Neto mes"
            value={fmtMoney(row.monthIncomeDOP - row.monthExpenseDOP)}
            tone={
              row.monthIncomeDOP - row.monthExpenseDOP >= 0
                ? 'brand'
                : 'coral'
            }
            Icon={
              row.monthIncomeDOP - row.monthExpenseDOP >= 0
                ? TrendingDown
                : undefined
            }
          />
        </div>
      </button>
      <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--overlay-1)] text-tiny text-[var(--muted)] inline-flex items-center gap-1.5 w-full">
        Click para abrir su presupuesto
        <ArrowRight size={10} strokeWidth={2.4} />
      </div>
    </Card>
  )
}

function KpiCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'brand' | 'coral'
  Icon?: typeof TrendingDown
}) {
  const color =
    tone === 'brand' ? 'text-[var(--brand-text)]' : 'text-[var(--coral-text)]'
  return (
    <div>
      <div className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
        {label}
      </div>
      <div className={`text-body-sm font-semibold tabular-nums num mt-0.5 ${color}`}>
        {value}
      </div>
    </div>
  )
}
