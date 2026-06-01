'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ShoppingBag,
  UtensilsCrossed,
  Briefcase,
  Plus,
  Trash2,
  Check,
  Mail,
} from 'lucide-react'
import {
  createClientBudget,
  type BusinessType,
  type AccountSeed,
} from '../actions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AlertBanner } from '@/components/ui/AlertBanner'

/**
 * Wizard simple para crear un cliente: 3 pasos visibles, todos en
 * una sola page. Mantenemos plano (sin step-by-step modal flow)
 * porque el auditor profesional quiere ver todo a la vez y editar
 * cualquier campo en cualquier momento.
 */

const BUSINESS_TYPES: { id: BusinessType; label: string; Icon: typeof Building2 }[] = [
  { id: 'servicios', label: 'Servicios profesionales', Icon: Briefcase },
  { id: 'comercio', label: 'Comercio / Retail', Icon: ShoppingBag },
  { id: 'restaurante', label: 'Restaurante / Comida', Icon: UtensilsCrossed },
  { id: 'generico', label: 'Otro / Genérico', Icon: Building2 },
]

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
  const [businessType, setBusinessType] = useState<BusinessType>('servicios')
  const [currency, setCurrency] = useState<'DOP' | 'USD'>('DOP')
  const [accounts, setAccounts] = useState<AccountSeed[]>([
    { name: '', type: 'checking', balance: 0, currency: 'DOP' },
  ])

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = clientLabel.trim().length > 0 && validEmail

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
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  }

  const handleSubmit = () => {
    if (!valid) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      // Filtra cuentas vacías (sin nombre)
      const cleanAccounts = accounts
        .filter((a) => a.name.trim().length > 0)
        .map((a) => ({
          ...a,
          name: a.name.trim(),
          balance: Number.isFinite(a.balance) ? a.balance : 0,
        }))
      const r = await createClientBudget({
        clientLabel: clientLabel.trim(),
        email: email.trim().toLowerCase(),
        businessType,
        currency,
        accounts: cleanAccounts,
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
            Nombre comercial y email donde recibirá el acceso.
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
              placeholder="Ej: Restaurante Don Pepe"
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
              placeholder="contacto@empresa.com"
              className="w-full mt-1 !text-body !py-2.5 !px-3 !rounded-xl"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 text-meta text-[var(--muted)] leading-relaxed">
          <Mail size={12} strokeWidth={2.2} className="text-[var(--brand-text)] mt-0.5 shrink-0" />
          <span>
            Le mandamos un magic link. Al hacer click queda autenticado y ve su
            presupuesto sin tener que crear contraseña ni completar onboarding.
          </span>
        </div>
      </Card>

      {/* Step 2: tipo de negocio + moneda */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-emph font-semibold text-[var(--text)]">
            2. Tipo de negocio
          </h2>
          <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
            Define qué categorías iniciales generamos. Puedes editarlas después.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUSINESS_TYPES.map((t) => {
            const isActive = businessType === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setBusinessType(t.id)}
                className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                  isActive
                    ? 'border-[var(--brand-2)]/50 bg-[rgba(61,220,151,0.06)] text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text2)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)]'
                }`}
              >
                <t.Icon
                  size={16}
                  strokeWidth={2.2}
                  className={`mx-auto ${isActive ? 'text-[var(--brand-text)]' : 'text-[var(--muted)]'}`}
                />
                <div className="text-meta mt-2 font-medium">{t.label}</div>
              </button>
            )
          })}
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
      </Card>

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
                    updateAccount(i, { currency: e.target.value as 'DOP' | 'USD' })
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
                    updateAccount(i, { balance: parseFloat(e.target.value) || 0 })
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
  )
}
