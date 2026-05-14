'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Wallet,
  LogOut,
  Trash2,
  AlertCircle,
  Check,
  Bell,
  Download,
  FileJson,
  FileSpreadsheet,
  Sparkles,
  Sun,
  Moon,
  Palette,
} from 'lucide-react'
import { useTheme, type ThemeMode } from '@/components/ui/ThemeProvider'
import Link from 'next/link'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { logout } from '@/app/(auth)/actions'
import {
  updateProfile,
  updateBudgetSettings,
  setEmailNotifications,
  exportBudgetJSON,
  exportTransactionsCSV,
  deleteMyAccount,
  type Currency,
} from './actions'

interface BudgetData {
  id: string
  name: string
  currency: Currency
  usdToDopRate: number
}

interface Props {
  email: string
  displayName: string
  plan: string
  emailNotifications: boolean
  budget: BudgetData | null
}

export function AjustesClient({
  email,
  displayName,
  plan,
  emailNotifications,
  budget,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [, startSave] = useTransition()
  const [, startDelete] = useTransition()
  const [, startToggle] = useTransition()
  const [emailNotif, setEmailNotif] = useState(emailNotifications)
  const [emailNotifError, setEmailNotifError] = useState<string | null>(null)

  const toggleEmailNotif = (next: boolean) => {
    setEmailNotif(next)
    setEmailNotifError(null)
    startToggle(async () => {
      const r = await setEmailNotifications(next)
      if (r && 'error' in r && r.error) {
        setEmailNotif(!next) // revert
        setEmailNotifError(r.error)
      } else {
        router.refresh()
      }
    })
  }

  // Profile section state
  const [name, setName] = useState(displayName)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const profileDirty = name.trim() !== displayName.trim()

  // Budget section state
  const [budgetName, setBudgetName] = useState(budget?.name ?? '')
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? 'DOP')
  const [usdRate, setUsdRate] = useState<string>(
    String(budget?.usdToDopRate ?? 60),
  )
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetSavedAt, setBudgetSavedAt] = useState<number | null>(null)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const usdRateNum = parseFloat(usdRate.replace(',', '.'))
  const budgetDirty =
    !!budget &&
    (budgetName.trim() !== budget.name.trim() ||
      currency !== budget.currency ||
      Math.abs((Number.isFinite(usdRateNum) ? usdRateNum : 0) - budget.usdToDopRate) > 0.0001)

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

  const handleSaveBudget = async () => {
    if (!budget || !budgetDirty || !budgetName.trim()) return

    // Changing the currency relabels every existing amount in the app
    // (DOP balances stay numeric but get displayed with $ instead of
    // RD$). Confirm explicitly to avoid accidental clicks.
    if (currency !== budget.currency) {
      const ok = await confirm({
        title: '¿Cambiar la moneda del presupuesto?',
        description: `Pasar de ${budget.currency} a ${currency} cambia cómo mostramos todas tus cifras. Tus saldos numéricos no se recalculan; solo cambia el símbolo y la conversión que usamos para cuentas en otra moneda.`,
        confirmLabel: 'Sí, cambiar',
        tone: 'danger',
      })
      if (!ok) return
    }

    setBudgetError(null)
    setBudgetSaving(true)
    startSave(async () => {
      const r = await updateBudgetSettings({
        budgetId: budget.id,
        name: budgetName,
        currency,
        usdToDopRate: Number.isFinite(usdRateNum) ? usdRateNum : 60,
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--overlay-1)] border border-[var(--border)] text-[12px] font-semibold capitalize text-[var(--text2)]">
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
              DOP muestra <span className="num">RD$1,234.56</span>; USD muestra{' '}
              <span className="num">$1,234.56</span>.
            </p>
          </Field>
          <Field label="Tipo de cambio USD↔DOP">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--text2)] tabular-nums num shrink-0">
                1 USD =
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                placeholder="60.00"
                className="w-32 !text-[14px] !py-2.5 !px-3 !rounded-xl tabular-nums num text-right"
              />
              <span className="text-[12px] text-[var(--text2)] shrink-0">DOP</span>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
              Se actualiza solo cada día con la tasa del Banco Central. Edítala aquí solo si quieres usar una tasa específica (la del banco que usas, por ejemplo).
            </p>
          </Field>
          <SaveBar
            dirty={budgetDirty}
            pending={budgetSaving}
            onSave={handleSaveBudget}
            onReset={() => {
              setBudgetName(budget.name)
              setCurrency(budget.currency)
              setUsdRate(String(budget.usdToDopRate))
            }}
          />
        </Section>
      )}

      {/* Notifications */}
      <Section title="Notificaciones" Icon={Bell} error={emailNotifError}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-[var(--text)]">
              Correo electrónico
            </p>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-1">
              Recibe avisos a <span className="text-[var(--text2)]">{email}</span> cuando
              se acerca un movimiento programado, una deuda próxima a vencer o tu
              suscripción está por expirar.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailNotif}
            onClick={() => toggleEmailNotif(!emailNotif)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              emailNotif
                ? 'bg-[var(--success)]'
                : 'bg-[var(--overlay-4)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${
                emailNotif ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <div className="pt-3 mt-3 border-t border-[var(--border)]">
          <PushToggle />
        </div>
      </Section>

      {/* Apariencia */}
      <ThemeSection />

      {/* Plan / billing */}
      <Section title="Plan y suscripción" Icon={Sparkles}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-[var(--text)]">
              {plan === 'pro'
                ? 'MARELL Pro activo'
                : plan === 'trial'
                  ? 'Prueba gratuita activa'
                  : 'Plan gratis'}
            </div>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-1">
              {plan === 'pro'
                ? 'Todas las funciones desbloqueadas. Cancela cuando quieras.'
                : plan === 'trial'
                  ? 'Disfruta todas las funciones gratis. Cuando termine, pasa a Pro por RD$999/mes.'
                  : 'Activa Pro para recuperar acceso a metas, programadas, reportes e importadores.'}
            </p>
          </div>
          <Link
            href="/app/upgrade"
            className="h-10 px-4 text-[13px] font-semibold rounded-xl gradient-bg text-[#0B0B0C] hover:brightness-105 inline-flex items-center gap-2 transition-[filter] shrink-0"
          >
            {plan === 'pro' ? 'Administrar' : 'Pasar a Pro'}
          </Link>
        </div>
      </Section>

      {/* Data export */}
      <ExportSection />

      {/* Session */}
      <Section title="Sesión" Icon={LogOut}>
        <p className="text-[13px] text-[var(--text2)] leading-relaxed">
          Cierra sesión en este dispositivo. Tus datos quedan intactos.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="h-10 px-5 text-[13px] font-medium rounded-xl bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text)] transition-colors inline-flex items-center gap-2"
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
          className="h-10 px-5 text-[13px] font-semibold rounded-xl bg-[var(--coral)]/15 hover:bg-[var(--coral)]/25 text-[var(--coral-text)] border border-[var(--coral)]/30 transition-colors inline-flex items-center gap-2"
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
                ? 'bg-[rgba(255,122,89,0.12)] text-[var(--coral-text)]'
                : 'bg-[var(--overlay-1)] text-[var(--text2)]'
            }`}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <h2
            className={`text-[15px] font-semibold tracking-tight ${
              isDanger ? 'text-[var(--coral-text)]' : 'text-[var(--text)]'
            }`}
          >
            {title}
          </h2>
        </div>
        {savedAt && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--brand-text)] font-semibold animate-step">
            <Check size={12} strokeWidth={2.4} />
            Guardado
          </div>
        )}
      </header>

      <div className="space-y-4">{children}</div>

      {error && (
        <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral-text)] shrink-0 mt-0.5" />
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
        className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] rounded-lg transition-colors disabled:opacity-60"
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

function ExportSection() {
  const [pendingType, setPendingType] = useState<'json' | 'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const triggerDownload = (filename: string, payload: string, mimeType: string) => {
    const blob = new Blob([payload], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleJson = async () => {
    setError(null)
    setPendingType('json')
    const r = await exportBudgetJSON()
    setPendingType(null)
    if (r.error || !r.payload || !r.filename || !r.mimeType) {
      setError(r.error ?? 'No se pudo exportar')
      return
    }
    triggerDownload(r.filename, r.payload, r.mimeType)
  }

  const handleCsv = async () => {
    setError(null)
    setPendingType('csv')
    const r = await exportTransactionsCSV()
    setPendingType(null)
    if (r.error || !r.payload || !r.filename || !r.mimeType) {
      setError(r.error ?? 'No se pudo exportar')
      return
    }
    triggerDownload(r.filename, r.payload, r.mimeType)
  }

  return (
    <Section title="Tus datos" Icon={Download} error={error}>
      <p className="text-[13px] text-[var(--text2)] leading-relaxed">
        Descarga tu información cuando quieras. Es tuya, sin candados.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleJson}
          disabled={pendingType !== null}
          className="text-left rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-4 py-3 flex items-start gap-3 transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
            <FileJson size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--text)]">
              Backup JSON
            </div>
            <div className="text-[11px] text-[var(--muted)] leading-relaxed mt-0.5">
              {pendingType === 'json' ? 'Generando…' : 'Todo: presupuesto, cuentas, transacciones, metas.'}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={handleCsv}
          disabled={pendingType !== null}
          className="text-left rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-4 py-3 flex items-start gap-3 transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
            <FileSpreadsheet size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--text)]">
              Transacciones CSV
            </div>
            <div className="text-[11px] text-[var(--muted)] leading-relaxed mt-0.5">
              {pendingType === 'csv' ? 'Generando…' : 'Para Excel, Numbers o Google Sheets.'}
            </div>
          </div>
        </button>
      </div>
    </Section>
  )
}


function PushToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Reflect current browser state on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEnabled(false)
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setEnabled(!!sub && Notification.permission === 'granted')
    })
  }, [])

  const handleToggle = async (next: boolean) => {
    setError(null)
    startTransition(async () => {
      if (next) {
        const { registerPushNotifications } = await import('@/lib/push/register')
        const r = await registerPushNotifications()
        if (!r.ok) {
          const msg = r.reason === 'denied'
            ? 'Permiso denegado. Habilítalo en ajustes del navegador.'
            : r.reason === 'unsupported'
              ? 'Tu navegador no soporta notificaciones push.'
              : r.reason === 'no-vapid-key'
                ? 'Configuración pendiente del servidor.'
                : 'No se pudo activar.'
          setError(msg)
          return
        }
        setEnabled(true)
      } else {
        const { unregisterPushNotifications } = await import('@/lib/push/register')
        await unregisterPushNotifications()
        setEnabled(false)
      }
    })
  }

  if (enabled === null) return null
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--text)]">
            Notificaciones push
          </p>
          <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-1">
            Recibe alertas en tu teléfono o navegador cuando se asignan pagos, vencen metas o se acerca una transacción programada.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={() => handleToggle(!enabled)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? "bg-[var(--success)]" : "bg-[var(--overlay-4)]"} disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-[var(--coral-text)] mt-2 leading-relaxed">{error}</p>
      )}
    </>
  )
}

/**
 * Apariencia: light / dark / system. Lives in the user's browser
 * (localStorage), no server roundtrip — same device, same setting.
 * Tres opciones tipo segmented control con icono y label.
 */
function ThemeSection() {
  const { mode, setMode } = useTheme()
  const options: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { id: 'light', label: 'Claro', Icon: Sun },
    { id: 'dark', label: 'Oscuro', Icon: Moon },
  ]

  return (
    <Section title="Apariencia" Icon={Palette}>
      <p className="text-[12px] text-[var(--muted)] mb-3 leading-relaxed">
        Elige entre claro u oscuro.
      </p>
      <div
        role="radiogroup"
        aria-label="Tema"
        className="grid grid-cols-2 gap-2 p-1 bg-[var(--overlay-1)] rounded-xl"
      >
        {options.map((opt) => {
          const active = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(opt.id)}
              className={`h-11 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                active
                  ? 'gradient-bg text-[#0B0B0C] shadow-[0_4px_16px_rgba(61,220,151,0.18)]'
                  : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)]'
              }`}
            >
              <opt.Icon size={14} strokeWidth={2.2} />
              {opt.label}
            </button>
          )
        })}
      </div>
    </Section>
  )
}
