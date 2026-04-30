'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Wallet,
  LogOut,
  Trash2,
  AlertCircle,
  Check,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { logout } from '@/app/(auth)/actions'
import {
  updateProfile,
  updateBudgetSettings,
  deleteMyAccount,
  type Currency,
} from './actions'

interface BudgetData {
  id: string
  name: string
  currency: Currency
}

interface Props {
  email: string
  displayName: string
  plan: string
  budget: BudgetData | null
}

export function AjustesClient({ email, displayName, plan, budget }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [, startSave] = useTransition()
  const [, startDelete] = useTransition()

  // Profile section state
  const [name, setName] = useState(displayName)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const profileDirty = name.trim() !== displayName.trim()

  // Budget section state
  const [budgetName, setBudgetName] = useState(budget?.name ?? '')
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? 'DOP')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetSavedAt, setBudgetSavedAt] = useState<number | null>(null)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const budgetDirty =
    !!budget &&
    (budgetName.trim() !== budget.name.trim() || currency !== budget.currency)

  const handleSaveProfile = () => {
    if (!profileDirty || !name.trim()) return
    setProfileError(null)
    setProfileSaving(true)
    startSave(async () => {
      const r = await updateProfile({ displayName: name })
      setProfileSaving(false)
      if ('error' in r && r.error) {
        setProfileError(r.error)
        return
      }
      setProfileSavedAt(Date.now())
      router.refresh()
      window.setTimeout(() => setProfileSavedAt(null), 2500)
    })
  }

  const handleSaveBudget = () => {
    if (!budget || !budgetDirty || !budgetName.trim()) return
    setBudgetError(null)
    setBudgetSaving(true)
    startSave(async () => {
      const r = await updateBudgetSettings({
        budgetId: budget.id,
        name: budgetName,
        currency,
      })
      setBudgetSaving(false)
      if ('error' in r && r.error) {
        setBudgetError(r.error)
        return
      }
      setBudgetSavedAt(Date.now())
      router.refresh()
      window.setTimeout(() => setBudgetSavedAt(null), 2500)
    })
  }

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: '¿Eliminar tu cuenta?',
      description:
        'Esto borra todos tus datos: presupuesto, cuentas, transacciones, metas y recurrencias. Tu sesión se cierra y volverás al login. No se puede deshacer.',
      confirmLabel: 'Eliminar todo',
      tone: 'danger',
    })
    if (!ok) return
    startDelete(async () => {
      await deleteMyAccount()
      // server action does signOut + redirect; nothing to do here
    })
  }

  return (
    <div className="space-y-7 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Ajustes
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Tu <span className="gradient-text">cuenta</span>.
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed">
          Perfil, presupuesto, sesión y zona de peligro.
        </p>
      </div>

      {/* Profile */}
      <Section
        title="Perfil"
        Icon={User}
        savedAt={profileSavedAt}
        error={profileError}
      >
        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Cómo te llamas"
            className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
          />
        </Field>
        <Field label="Email">
          <input
            type="text"
            value={email}
            readOnly
            className="w-full !text-[14px] !py-3 !px-4 !rounded-xl !bg-[var(--bg)] !text-[var(--muted)] cursor-not-allowed"
          />
          <p className="text-[11px] text-[var(--muted)] mt-1.5">
            El email se gestiona desde tu proveedor de autenticación.
          </p>
        </Field>
        <Field label="Plan">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-[var(--border)] text-[12px] font-semibold capitalize text-[var(--text2)]">
            {plan}
          </div>
        </Field>
        <SaveBar
          dirty={profileDirty}
          pending={profileSaving}
          onSave={handleSaveProfile}
          onReset={() => setName(displayName)}
        />
      </Section>

      {/* Budget */}
      {budget && (
        <Section
          title="Presupuesto"
          Icon={Wallet}
          savedAt={budgetSavedAt}
          error={budgetError}
        >
          <Field label="Nombre">
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              maxLength={80}
              placeholder="Mi presupuesto"
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>
          <Field label="Moneda">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setCurrency('DOP')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  currency === 'DOP'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                DOP · Peso dominicano
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  currency === 'USD'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                USD · Dólar
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">
              Por ahora afecta solo el código de moneda; el formato visual se mantiene en `$`.
            </p>
          </Field>
          <SaveBar
            dirty={budgetDirty}
            pending={budgetSaving}
            onSave={handleSaveBudget}
            onReset={() => {
              setBudgetName(budget.name)
              setCurrency(budget.currency)
            }}
          />
        </Section>
      )}

      {/* Session */}
      <Section title="Sesión" Icon={LogOut}>
        <p className="text-[13px] text-[var(--text2)] leading-relaxed">
          Cierra sesión en este dispositivo. Tus datos quedan intactos.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="h-10 px-5 text-[13px] font-medium rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] transition-colors inline-flex items-center gap-2"
          >
            <LogOut size={14} strokeWidth={2.2} />
            Cerrar sesión
          </button>
        </form>
      </Section>

      {/* Danger zone */}
      <Section
        title="Zona de peligro"
        Icon={Trash2}
        tone="danger"
      >
        <p className="text-[13px] text-[var(--text2)] leading-relaxed">
          Eliminar tu cuenta borra <strong className="text-[var(--text)]">todos</strong> tus datos
          (presupuesto, cuentas, transacciones, metas, recurrencias) de forma permanente.
          Te enviamos al login después.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="h-10 px-5 text-[13px] font-semibold rounded-xl bg-[var(--coral)]/15 hover:bg-[var(--coral)]/25 text-[var(--coral)] border border-[var(--coral)]/30 transition-colors inline-flex items-center gap-2"
        >
          <Trash2 size={14} strokeWidth={2.2} />
          Eliminar cuenta
        </button>
      </Section>
    </div>
  )
}

interface SectionProps {
  title: string
  Icon: typeof User
  children: React.ReactNode
  savedAt?: number | null
  error?: string | null
  tone?: 'default' | 'danger'
}

function Section({ title, Icon, children, savedAt, error, tone = 'default' }: SectionProps) {
  const isDanger = tone === 'danger'
  return (
    <section
      className={`rounded-2xl border bg-[var(--s1)] p-5 sm:p-6 space-y-4 ${
        isDanger ? 'border-[var(--coral)]/30' : 'border-[var(--border)]'
      }`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isDanger
                ? 'bg-[rgba(255,122,89,0.12)] text-[var(--coral)]'
                : 'bg-white/[0.04] text-[var(--text2)]'
            }`}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <h2
            className={`text-[15px] font-semibold tracking-tight ${
              isDanger ? 'text-[var(--coral)]' : 'text-[var(--text)]'
            }`}
          >
            {title}
          </h2>
        </div>
        {savedAt && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--brand-2)] font-semibold animate-step">
            <Check size={12} strokeWidth={2.4} />
            Guardado
          </div>
        )}
      </header>

      <div className="space-y-4">{children}</div>

      {error && (
        <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral)] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
        </div>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  )
}

function SaveBar({
  dirty,
  pending,
  onSave,
  onReset,
}: {
  dirty: boolean
  pending: boolean
  onSave: () => void
  onReset: () => void
}) {
  if (!dirty) return null
  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
      <button
        type="button"
        onClick={onReset}
        disabled={pending}
        className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-60"
      >
        Descartar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
      >
        {pending ? (
          <>
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar cambios'
        )}
      </button>
    </div>
  )
}
