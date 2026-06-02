'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  Mail,
  FileUp,
  Pencil,
  X,
  Layers,
} from 'lucide-react'
import {
  createClientBudget,
  type AccountSeed,
  type PendingTxn,
} from '../actions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  ImportStatementsModal,
  type ImportedStatementsPayload,
} from './ImportStatementsModal'
import type { CategoryGroupSeed } from '@/lib/categories/aggregate-from-payees'

/**
 * Wizard simple para crear un cliente: 3 pasos visibles, todos en
 * una sola page. Mantenemos plano (sin step-by-step modal flow)
 * porque el auditor profesional quiere ver todo a la vez y editar
 * cualquier campo en cualquier momento.
 */

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Corriente' },
  { id: 'savings', label: 'Ahorros' },
  { id: 'cash', label: 'Caja' },
  { id: 'credit_card', label: 'Tarjeta de crédito' },
  { id: 'asset', label: 'Inversión / Activo' },
]

export function NuevoClienteWizard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clientLabel, setClientLabel] = useState('')
  const [email, setEmail] = useState('')
  const [currency, setCurrency] = useState<'DOP' | 'USD'>('DOP')
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroupSeed[]>([])
  const [accounts, setAccounts] = useState<AccountSeed[]>([
    { name: '', type: 'checking', balance: 0, currency: 'DOP' },
  ])
  // Transacciones importadas — vacío hasta que el modal devuelva
  // payload. accountTempId vincula con accounts[].tempId.
  const [importedTxns, setImportedTxns] = useState<PendingTxn[]>([])

  const [importOpen, setImportOpen] = useState(false)
  const [addingTo, setAddingTo] = useState<{
    mode: 'new-group' | 'existing'
    groupName?: string
  } | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = clientLabel.trim().length > 0 && validEmail
  const totalCategories = categoryGroups.reduce(
    (s, g) => s + g.categoryNames.length,
    0,
  )

  // ── Helpers categorías ─────────────────────────────────────────
  const mergeImportedGroups = (incoming: CategoryGroupSeed[]) => {
    setCategoryGroups((prev) => {
      const next = [...prev]
      for (const g of incoming) {
        const existing = next.find((x) => x.name === g.name)
        if (existing) {
          for (const c of g.categoryNames) {
            if (!existing.categoryNames.includes(c)) {
              existing.categoryNames.push(c)
            }
          }
        } else {
          next.push({ name: g.name, categoryNames: [...g.categoryNames] })
        }
      }
      return next
    })
  }

  /** Handler para el modal nuevo: recibe cuentas auto-detectadas,
   *  categorías propuestas y txns con sus vínculos. Reemplaza la
   *  primera cuenta vacía si existe, sino mergea. */
  const handleImportComplete = (payload: ImportedStatementsPayload) => {
    // Mergea cuentas: si la primera cuenta del wizard está vacía la
    // tiramos. El resto se concatena con tempId preservado.
    setAccounts((prev) => {
      const cleaned = prev.filter((a) => a.name.trim().length > 0)
      const incoming: AccountSeed[] = payload.accounts.map((a) => ({
        tempId: a.tempId,
        name: a.name,
        type: a.type,
        balance: a.openingBalance,
        currency: a.currency,
      }))
      return cleaned.length > 0 ? [...cleaned, ...incoming] : incoming
    })
    mergeImportedGroups(payload.categoryGroups)
    setImportedTxns((prev) => [...prev, ...payload.transactions])
  }

  /** Quita todas las txns importadas (no toca cuentas ni categorías).
   *  Útil si el auditor decide rehacer la asignación. */
  const clearImportedTxns = () => setImportedTxns([])

  const addCategoryToGroup = (groupName: string, categoryName: string) => {
    const trimmed = categoryName.trim()
    const trimmedGroup = groupName.trim()
    if (!trimmed || !trimmedGroup) return
    setCategoryGroups((prev) => {
      const next = [...prev]
      let group = next.find((g) => g.name === trimmedGroup)
      if (!group) {
        group = { name: trimmedGroup, categoryNames: [] }
        next.push(group)
      }
      if (!group.categoryNames.includes(trimmed)) {
        group.categoryNames.push(trimmed)
      }
      return next
    })
  }

  const removeCategory = (groupName: string, categoryName: string) => {
    setCategoryGroups((prev) =>
      prev
        .map((g) =>
          g.name === groupName
            ? { ...g, categoryNames: g.categoryNames.filter((c) => c !== categoryName) }
            : g,
        )
        .filter((g) => g.categoryNames.length > 0),
    )
  }

  const renameCategory = (
    groupName: string,
    oldName: string,
    newName: string,
  ) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setCategoryGroups((prev) =>
      prev.map((g) =>
        g.name === groupName
          ? {
              ...g,
              categoryNames: g.categoryNames.map((c) =>
                c === oldName && !g.categoryNames.includes(trimmed) ? trimmed : c,
              ),
            }
          : g,
      ),
    )
  }

  const removeGroup = (groupName: string) => {
    setCategoryGroups((prev) => prev.filter((g) => g.name !== groupName))
  }

  const commitNewCategory = () => {
    if (!addingTo) return
    const target =
      addingTo.mode === 'new-group' ? newGroupName.trim() : addingTo.groupName ?? ''
    if (!target || !newCategoryName.trim()) {
      setAddingTo(null)
      setNewCategoryName('')
      setNewGroupName('')
      return
    }
    addCategoryToGroup(target, newCategoryName)
    setAddingTo(null)
    setNewCategoryName('')
    setNewGroupName('')
  }

  // ── Helpers cuentas ────────────────────────────────────────────
  const addAccount = () => {
    setAccounts((prev) => [
      ...prev,
      { name: '', type: 'checking', balance: 0, currency },
    ])
  }
  const removeAccount = (i: number) => {
    setAccounts((prev) => prev.filter((_, idx) => idx !== i))
  }
  const updateAccount = (i: number, patch: Partial<AccountSeed>) => {
    setAccounts((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    )
  }

  const handleSubmit = () => {
    if (!valid) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const cleanAccounts = accounts
        .filter((a) => a.name.trim().length > 0)
        .map((a) => ({
          ...a,
          name: a.name.trim(),
          balance: Number.isFinite(a.balance) ? a.balance : 0,
        }))
      // Categorías: filtrar grupos vacíos. Si todo está vacío,
      // mandamos un fallback minimo "Otros > Por categorizar".
      const cleanGroups: CategoryGroupSeed[] = categoryGroups
        .map((g) => ({
          name: g.name.trim(),
          categoryNames: g.categoryNames
            .map((c) => c.trim())
            .filter((c) => c.length > 0),
        }))
        .filter((g) => g.name.length > 0 && g.categoryNames.length > 0)

      const r = await createClientBudget({
        clientLabel: clientLabel.trim(),
        email: email.trim().toLowerCase(),
        currency,
        categoryGroups:
          cleanGroups.length > 0
            ? cleanGroups
            : [{ name: 'Otros', categoryNames: ['Por categorizar'] }],
        accounts: cleanAccounts,
        transactions: importedTxns.length > 0 ? importedTxns : undefined,
      })
      if (r.error) {
        setError(r.error)
        return
      }
      setSuccess(
        `Cliente "${clientLabel}" creado. Le mandamos un email a ${email} con su acceso. Te llevamos a su dashboard…`,
      )
      setTimeout(() => {
        router.push('/app')
        router.refresh()
      }, 2000)
    })
  }

  return (
    <>
      <div className="space-y-7 max-w-3xl">
        <PageHeader
          eyebrow="Clientes · Nuevo"
          description="Crea el usuario y el presupuesto pre-configurado de un cliente. Le mandamos un email para que active su acceso."
        >
          Nuevo <span className="gradient-text">cliente</span>.
        </PageHeader>

        {/* Step 1: identificación */}
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-emph font-semibold text-[var(--text)]">
              1. Identificación del cliente
            </h2>
            <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
              Nombre y email donde recibirá el acceso. Selecciona también la
              moneda principal de su presupuesto.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                Nombre del cliente
              </label>
              <input
                type="text"
                value={clientLabel}
                onChange={(e) => setClientLabel(e.target.value)}
                placeholder="Ej: Ana Pérez"
                maxLength={80}
                className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl"
              />
            </div>
            <div>
              <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                Email del cliente
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@email.com"
                className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="text-eyebrow uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
              Moneda base
            </label>
            <div className="mt-1 inline-flex p-1 bg-[var(--overlay-1)] rounded-lg gap-1">
              {(['DOP', 'USD'] as const).map((c) => {
                const isActive = currency === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1.5 rounded-md text-body-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-[var(--s1)] text-[var(--text)] shadow-[inset_0_-2px_0_var(--brand-2)]'
                        : 'text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                  >
                    {c === 'DOP' ? 'RD$ Pesos' : 'US$ Dólares'}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-start gap-2 text-meta text-[var(--muted)] leading-relaxed">
            <Mail
              size={12}
              strokeWidth={2.2}
              className="text-[var(--brand-text)] mt-0.5 shrink-0"
            />
            <span>
              Le mandamos un magic link. Al hacer click queda autenticado y ve su
              presupuesto sin tener que crear contraseña ni completar onboarding.
            </span>
          </div>
        </Card>

        {/* Step 2: categorías iniciales */}
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-emph font-semibold text-[var(--text)]">
              2. Categorías iniciales
            </h2>
            <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
              Importa un estado de cuenta del cliente para detectar
              automáticamente qué categorías necesita, o agrégalas manualmente.
              Puedes saltar este paso — el cliente las agrega después.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[var(--brand-2)]/[0.10] text-[var(--brand-text)] font-semibold text-body-sm hover:bg-[var(--brand-2)]/[0.18] transition-colors"
            >
              <FileUp size={14} strokeWidth={2.4} />
              Importar estado de cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingTo({ mode: 'new-group' })
                setNewCategoryName('')
                setNewGroupName('')
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-[var(--border)] text-[var(--text2)] font-semibold text-body-sm hover:text-[var(--text)] hover:bg-[var(--overlay-1)] transition-colors"
            >
              <Plus size={14} strokeWidth={2.4} />
              Agregar manualmente
            </button>
          </div>

          {/* Inline add row (new group + category) */}
          {addingTo?.mode === 'new-group' && (
            <div className="rounded-xl border border-[var(--brand-2)]/30 bg-[var(--brand-2)]/[0.05] p-3 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                  Grupo
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ej: Esenciales"
                  list="existing-groups"
                  className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg"
                  autoFocus
                />
                <datalist id="existing-groups">
                  {categoryGroups.map((g) => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                  Categoría
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitNewCategory()
                    if (e.key === 'Escape') setAddingTo(null)
                  }}
                  placeholder="Ej: Vivienda"
                  className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={commitNewCategory}
                disabled={!newCategoryName.trim() || !newGroupName.trim()}
                className="h-9 px-3 rounded-lg gradient-bg text-[#0B0B0C] text-body-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => setAddingTo(null)}
                aria-label="Cancelar"
                className="w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {/* Lista de grupos con sus categorías */}
          {categoryGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-4 py-6 text-center">
              <Layers
                size={20}
                strokeWidth={1.8}
                className="mx-auto text-[var(--muted)]"
              />
              <p className="text-meta text-[var(--muted)] mt-2">
                Aún no hay categorías. Importa un estado de cuenta o agrégalas
                manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryGroups.map((g) => (
                <div
                  key={g.name}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-tiny uppercase tracking-[0.15em] text-[var(--muted2)] font-semibold">
                      {g.name}
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTo({ mode: 'existing', groupName: g.name })
                          setNewCategoryName('')
                        }}
                        className="text-meta text-[var(--brand-text)] hover:underline underline-offset-4 inline-flex items-center gap-1"
                      >
                        <Plus size={11} strokeWidth={2.4} />
                        Categoría
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGroup(g.name)}
                        aria-label={`Quitar grupo ${g.name}`}
                        className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
                      >
                        <Trash2 size={12} strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>

                  {/* Inline add row (existing group) */}
                  {addingTo?.mode === 'existing' &&
                    addingTo.groupName === g.name && (
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitNewCategory()
                            if (e.key === 'Escape') setAddingTo(null)
                          }}
                          placeholder="Nombre de la categoría"
                          autoFocus
                          className="flex-1 !text-body-sm !py-1.5 !px-3 !rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={commitNewCategory}
                          disabled={!newCategoryName.trim()}
                          className="h-8 px-3 rounded-lg gradient-bg text-[#0B0B0C] text-meta font-semibold disabled:opacity-40 disabled:pointer-events-none"
                        >
                          Agregar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingTo(null)}
                          aria-label="Cancelar"
                          className="w-8 h-8 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
                        >
                          <X size={12} strokeWidth={2.2} />
                        </button>
                      </div>
                    )}

                  <ul className="space-y-1">
                    {g.categoryNames.map((c) => (
                      <CategoryRow
                        key={`${g.name}::${c}`}
                        name={c}
                        onRename={(newName) => renameCategory(g.name, c, newName)}
                        onRemove={() => removeCategory(g.name, c)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-tiny text-[var(--muted)] mt-1">
                Total: {totalCategories}{' '}
                {totalCategories === 1 ? 'categoría' : 'categorías'} en{' '}
                {categoryGroups.length}{' '}
                {categoryGroups.length === 1 ? 'grupo' : 'grupos'}.
              </p>
            </div>
          )}
        </Card>

        {/* Banner: txns importadas pendientes */}
        {importedTxns.length > 0 && (
          <div className="rounded-2xl border border-[var(--brand-2)]/40 bg-[var(--brand-2)]/[0.06] px-4 py-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-body-sm text-[var(--text)]">
              <Check
                size={14}
                strokeWidth={2.4}
                className="text-[var(--brand-2)]"
              />
              <span>
                <strong>{importedTxns.length}</strong>{' '}
                {importedTxns.length === 1
                  ? 'transacción lista'
                  : 'transacciones listas'}{' '}
                para importar. Se crearán al guardar el cliente.
              </span>
            </div>
            <button
              type="button"
              onClick={clearImportedTxns}
              className="text-meta font-medium text-[var(--text2)] hover:text-[var(--coral-text)] inline-flex items-center gap-1"
            >
              <X size={12} strokeWidth={2.2} />
              Quitar
            </button>
          </div>
        )}

        {/* Step 3: cuentas iniciales */}
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-emph font-semibold text-[var(--text)]">
              3. Cuentas iniciales (opcional)
            </h2>
            <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
              Si tienes los balances de las cuentas del cliente, agrégalos para
              arrancar con data real. Si no, puedes saltar este paso — el cliente
              las agrega después.
            </p>
          </div>

          {accounts.map((a, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px_120px_auto] gap-2 items-end">
                <div>
                  <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => updateAccount(i, { name: e.target.value })}
                    placeholder="Ej: BHD, APAP, Caja chica"
                    className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                    Tipo
                  </label>
                  <select
                    value={a.type}
                    onChange={(e) => updateAccount(i, { type: e.target.value })}
                    className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg appearance-none cursor-pointer"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                    Moneda
                  </label>
                  <select
                    value={a.currency}
                    onChange={(e) =>
                      updateAccount(i, {
                        currency: e.target.value as 'DOP' | 'USD',
                      })
                    }
                    className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg appearance-none cursor-pointer"
                  >
                    <option value="DOP">DOP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="text-tiny uppercase tracking-[0.12em] text-[var(--muted2)] font-semibold">
                    Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={a.balance}
                    onChange={(e) =>
                      updateAccount(i, {
                        balance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full mt-1 !text-body-sm !py-2 !px-3 !rounded-lg tabular-nums num"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAccount(i)}
                  disabled={accounts.length === 1}
                  aria-label="Quitar cuenta"
                  className="w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addAccount}
            className="inline-flex items-center gap-1.5 text-meta font-medium text-[var(--brand-text)] hover:underline underline-offset-4"
          >
            <Plus size={12} strokeWidth={2.4} />
            Agregar otra cuenta
          </button>
        </Card>

        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {success && (
          <AlertBanner tone="success">
            <span className="inline-flex items-center gap-2">
              <Check size={14} strokeWidth={2.4} /> {success}
            </span>
          </AlertBanner>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={() => router.push('/app/clientes')}
            disabled={pending}
          >
            <ArrowLeft size={14} strokeWidth={2.2} /> Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleSubmit}
            disabled={!valid || pending}
          >
            {pending ? (
              <>
                <Spinner /> Creando cliente…
              </>
            ) : (
              <>
                Crear cliente y enviar acceso
                <ArrowRight size={14} strokeWidth={2.4} />
              </>
            )}
          </Button>
        </div>
      </div>

      <ImportStatementsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </>
  )
}

/** Row de categoría con rename inline + botón eliminar. */
function CategoryRow({
  name,
  onRename,
  onRemove,
}: {
  name: string
  onRename: (newName: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (editing) {
    return (
      <li className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onRename(draft)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRename(draft)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setDraft(name)
              setEditing(false)
            }
          }}
          autoFocus
          className="flex-1 !text-body-sm !py-1 !px-2 !rounded-md"
        />
      </li>
    )
  }
  return (
    <li className="flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-[var(--overlay-1)] group">
      <span className="text-body-sm text-[var(--text)]">{name}</span>
      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
          aria-label={`Renombrar ${name}`}
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
        >
          <Pencil size={11} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${name}`}
          className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[var(--overlay-2)] flex items-center justify-center"
        >
          <Trash2 size={11} strokeWidth={2.2} />
        </button>
      </div>
    </li>
  )
}
