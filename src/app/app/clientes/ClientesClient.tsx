'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Building2,
  FileUp,
  ListChecks,
  MoreVertical,
  PieChart,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import { setActiveBudget } from '@/lib/budget/actions'
import { endClientRelationship, importStatementsToBudget } from './actions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  ImportStatementsModal,
  type ImportedStatementsPayload,
} from './nuevo/ImportStatementsModal'
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
  const confirm = useConfirm()
  const fmtMoney = useFormatMoney()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [pending, startTransition] = useTransition()

  // Estado para el modal "Importar estado de cuenta" lanzado desde
  // el kebab de un cliente. clientBudgetId = budget destino.
  const [importTarget, setImportTarget] = useState<{
    budgetId: string
    clientLabel: string
  } | null>(null)
  const [importResult, setImportResult] = useState<{
    label: string
    inserted: number
    accountsCreated: number
    categoriesCreated: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  /** Termina la relación auditor↔cliente. Confirma antes y muestra
   *  un banner de éxito al volver. NO borra al cliente ni su data —
   *  solo el auditor pierde acceso. */
  const handleDeleteClient = async (
    agencyRelationshipId: string,
    clientLabel: string,
  ) => {
    const ok = await confirm({
      title: `¿Dejar de auditar a ${clientLabel}?`,
      description:
        'Vas a perder acceso a su presupuesto, cuentas y transacciones. El cliente conserva toda su data y su acceso a MARELL.',
      confirmLabel: 'Sí, eliminar relación',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!ok) return
    setImportError(null)
    startTransition(async () => {
      const r = await endClientRelationship(agencyRelationshipId)
      if (r.error) {
        setImportError(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleImportToClient = (payload: ImportedStatementsPayload) => {
    if (!importTarget) return
    setImporting(true)
    setImportError(null)
    startTransition(async () => {
      const r = await importStatementsToBudget({
        budgetId: importTarget.budgetId,
        accounts: payload.accounts,
        categoryGroups: payload.categoryGroups,
        transactions: payload.transactions,
      })
      setImporting(false)
      if (r.error) {
        setImportError(r.error)
        return
      }
      const s = r.summary
      setImportResult({
        label: importTarget.clientLabel,
        inserted: s?.transactionsInserted ?? 0,
        accountsCreated: s?.accountsCreated ?? 0,
        categoriesCreated: s?.categoriesCreated ?? 0,
      })
      setImportTarget(null)
      router.refresh()
    })
  }

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

  /** Quick-link: cambia el active budget y salta directo a la ruta
   *  pedida (Plan/Transacciones/Análisis) sin pasar por el Resumen. */
  const openClientAt = (budgetId: string, path: string) => {
    startTransition(async () => {
      await setActiveBudget(budgetId)
      router.push(path)
      router.refresh()
    })
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-7 max-w-2xl">
        <PageHeader
          eyebrow="Clientes"
          description="Crea y administra los clientes que auditas. Cada uno tiene su propio login y solo ve su propio presupuesto."
        >
          Tus <span className="gradient-text">clientes</span>.
        </PageHeader>

        {/* Empty state mejorado — vende el feature en vez de solo
            avisar que no hay nada. El allowlisted que entra por
            primera vez aterriza aquí y necesita entender qué pasa. */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] flex items-center justify-center mx-auto mb-5">
            <Building2 size={28} strokeWidth={1.8} />
          </div>
          <h2 className="text-h3 font-bold text-[var(--text)]">
            Aún no gestionas clientes
          </h2>
          <p className="text-body text-[var(--text2)] mt-3 leading-relaxed max-w-md mx-auto">
            Como auditor puedes crear presupuestos para familias, amigos o
            personas que asesoras. Cada cliente tiene su propio plan,
            transacciones y reportes — totalmente separados del tuyo.
          </p>
          <ul className="mt-5 space-y-2 text-meta text-[var(--text2)] text-left max-w-xs mx-auto">
            <li className="inline-flex items-start gap-2">
              <span className="text-[var(--brand-text)] mt-0.5">✓</span>
              <span>El cliente NO necesita crear cuenta antes</span>
            </li>
            <li className="inline-flex items-start gap-2">
              <span className="text-[var(--brand-text)] mt-0.5">✓</span>
              <span>Tú lo configuras y le mandas un magic link</span>
            </li>
            <li className="inline-flex items-start gap-2">
              <span className="text-[var(--brand-text)] mt-0.5">✓</span>
              <span>Cambias entre tu cuenta y la de él en 1 click</span>
            </li>
          </ul>
          {canCreate ? (
            <Link
              href="/app/clientes/nuevo"
              className="mt-6 inline-flex items-center gap-2 h-11 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body-sm rounded-xl glow-on-hover hover:brightness-105 transition-[filter]"
            >
              <Plus size={14} strokeWidth={2.4} />
              Crear mi primer cliente
            </Link>
          ) : (
            <p className="mt-6 text-meta text-[var(--muted)]">
              Pídenos acceso a este feature escribiendo a{' '}
              <a
                href="mailto:soporte@marell.app"
                className="text-[var(--brand-text)] hover:underline underline-offset-4"
              >
                soporte@marell.app
              </a>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className={`space-y-7 ${pending ? 'opacity-60' : ''} transition-opacity`}>
      {/* Banner de resultado de import — desaparece al cerrar */}
      {importResult && (
        <AlertBanner tone="success">
          <span className="inline-flex items-center justify-between gap-3 w-full">
            <span>
              Importamos <strong>{importResult.inserted}</strong>{' '}
              {importResult.inserted === 1
                ? 'movimiento'
                : 'movimientos'}{' '}
              a <strong>{importResult.label}</strong>
              {importResult.accountsCreated > 0 && (
                <>
                  {' '}· {importResult.accountsCreated}{' '}
                  {importResult.accountsCreated === 1
                    ? 'cuenta nueva'
                    : 'cuentas nuevas'}
                </>
              )}
              {importResult.categoriesCreated > 0 && (
                <>
                  {' '}· {importResult.categoriesCreated}{' '}
                  {importResult.categoriesCreated === 1
                    ? 'categoría nueva'
                    : 'categorías nuevas'}
                </>
              )}
              .
            </span>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="text-meta font-medium opacity-70 hover:opacity-100"
            >
              Cerrar
            </button>
          </span>
        </AlertBanner>
      )}
      {importError && (
        <AlertBanner tone="danger">
          <span className="inline-flex items-center justify-between gap-3 w-full">
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="text-meta font-medium opacity-70 hover:opacity-100"
            >
              Cerrar
            </button>
          </span>
        </AlertBanner>
      )}
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
              onQuickLink={(path) => openClientAt(c.clientBudgetId, path)}
              onImport={() =>
                setImportTarget({
                  budgetId: c.clientBudgetId,
                  clientLabel: c.clientLabel,
                })
              }
              onDelete={() =>
                handleDeleteClient(c.agencyRelationshipId, c.clientLabel)
              }
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>

    {/* Modal de importar estado de cuenta a un cliente existente.
        Se monta a nivel root para que su backdrop cubra todo. */}
    {importTarget && (
      <ImportStatementsModal
        isOpen={true}
        onClose={() => {
          if (importing) return
          setImportTarget(null)
        }}
        onImportComplete={handleImportToClient}
      />
    )}
    </>
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
  onQuickLink,
  onImport,
  onDelete,
  pending,
}: {
  row: ClientDashboardRow
  fmtMoney: (n: number) => string
  onOpen: () => void
  onQuickLink: (path: string) => void
  onImport: () => void
  onDelete: () => void
  pending: boolean
}) {
  return (
    <Card className="relative overflow-hidden hover:border-[var(--brand-2)]/40 transition-colors">
      {/* Main click area — abre el Resumen del cliente. Es el comportamiento
          por defecto; el kebab de acciones rápidas (posicionado absolute
          encima) salta directo a Plan/Transacciones/Análisis. */}
      <button
        type="button"
        onClick={onOpen}
        disabled={pending}
        className="w-full text-left disabled:opacity-50 disabled:pointer-events-none"
      >
        <header className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
          {/* pr-9 deja espacio para el kebab posicionado absolute */}
          <div className="min-w-0 flex-1 pr-9">
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
      {/* Kebab: sibling del button para no anidar <button> dentro de
          <button>. Absolute top-right del header. */}
      <ClientCardMenu
        onSelect={onQuickLink}
        onImport={onImport}
        onDelete={onDelete}
        disabled={pending}
      />
      <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--overlay-1)] text-tiny text-[var(--muted)] inline-flex items-center gap-1.5 w-full">
        Click para abrir su presupuesto
        <ArrowRight size={10} strokeWidth={2.4} />
      </div>
    </Card>
  )
}

/**
 * Menú de acciones rápidas por cliente. Posicionado absolute en la
 * esquina superior derecha de la card. Cada opción salta directo a
 * una ruta del cliente (cambia active budget + push).
 */
function ClientCardMenu({
  onSelect,
  onImport,
  onDelete,
  disabled,
}: {
  onSelect: (path: string) => void
  onImport: () => void
  onDelete: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
    null,
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Posición fija en viewport calculada del bounding rect del botón.
  // Necesaria porque la Card tiene overflow-hidden que recorta cualquier
  // dropdown posicionado absolute dentro de ella. Portaleamos a body.
  const updateAnchor = () => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setAnchor({
      top: rect.bottom + 6, // 6px mt
      right: window.innerWidth - rect.right,
    })
  }

  useEffect(() => {
    if (!open) return
    updateAnchor()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onResize = () => updateAnchor()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  const items: { label: string; path: string; Icon: typeof ListChecks }[] = [
    { label: 'Ir a Plan', path: '/app/plan', Icon: ListChecks },
    { label: 'Ver Transacciones', path: '/app/transacciones', Icon: BarChart3 },
    { label: 'Ver Análisis', path: '/app/analisis', Icon: PieChart },
  ]

  return (
    <div className="absolute top-2.5 right-2.5 z-10">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Acciones rápidas"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--muted2)] hover:bg-[var(--overlay-2)] hover:text-[var(--text)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        <MoreVertical size={14} strokeWidth={2.2} />
      </button>
      {open &&
        anchor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: anchor.top,
              right: anchor.right,
              zIndex: 50,
            }}
            className="w-60 rounded-xl border border-[var(--border)] bg-[var(--s1)] shadow-xl p-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onImport()
              }}
              className="w-full text-left inline-flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-body-sm font-semibold text-[var(--brand-text)] hover:bg-[var(--brand-2)]/[0.10] transition-colors"
            >
              <FileUp
                size={13}
                strokeWidth={2.4}
                className="text-[var(--brand-text)]"
              />
              Importar estado de cuenta
            </button>
            <div className="my-1 h-px bg-[var(--border)]" />
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onSelect(item.path)
                }}
                className="w-full text-left inline-flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-body-sm text-[var(--text)] hover:bg-[var(--overlay-2)] transition-colors"
              >
                <item.Icon
                  size={13}
                  strokeWidth={2.2}
                  className="text-[var(--muted)]"
                />
                {item.label}
              </button>
            ))}
            <div className="my-1 h-px bg-[var(--border)]" />
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onDelete()
              }}
              className="w-full text-left inline-flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-body-sm text-[var(--coral-text)] hover:bg-[var(--coral)]/[0.10] transition-colors"
            >
              <Trash2 size={13} strokeWidth={2.2} />
              Eliminar cliente
            </button>
          </div>,
          document.body,
        )}
    </div>
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
