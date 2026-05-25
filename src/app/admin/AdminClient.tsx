'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  Shield,
  ShieldOff,
  CalendarPlus,
  ArrowDownToLine,
  Users,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  recordPayment,
  extendTrial,
  setApproved,
  setFree,
  deleteUser,
} from './actions'

export interface AdminUser {
  id: string
  email: string
  displayName: string | null
  plan: string
  trialEndsAt: string | null
  proExpiresAt: string | null
  approved: boolean
  onboarded: boolean
  signedUpAt: string
  lastSignInAt: string | null
}

type Filter = 'todos' | 'trial' | 'pro' | 'vencidos' | 'sin_aprobar'

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const fmtRelative = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diffDays = Math.round((d - now) / 86400000)
  if (diffDays === 0) return 'hoy'
  if (diffDays > 0) return `en ${diffDays}d`
  return `hace ${Math.abs(diffDays)}d`
}

interface UserStatus {
  label: string
  tone: 'green' | 'amber' | 'red' | 'gray' | 'blue'
  detail?: string
}

function statusFor(u: AdminUser): UserStatus {
  if (!u.approved) return { label: 'Bloqueado', tone: 'red' }
  if (u.plan === 'pro') {
    if (!u.proExpiresAt) return { label: 'Pro', tone: 'green' }
    const daysLeft = Math.round(
      (new Date(u.proExpiresAt).getTime() - Date.now()) / 86400000,
    )
    if (daysLeft < 0)
      return { label: 'Pro vencido', tone: 'red', detail: `hace ${Math.abs(daysLeft)}d` }
    if (daysLeft <= 7)
      return { label: 'Pro', tone: 'amber', detail: `vence en ${daysLeft}d` }
    return { label: 'Pro', tone: 'green', detail: `${daysLeft}d` }
  }
  if (u.plan === 'free') return { label: 'Free', tone: 'gray' }
  // trial
  if (u.trialEndsAt) {
    const daysLeft = Math.round(
      (new Date(u.trialEndsAt).getTime() - Date.now()) / 86400000,
    )
    if (daysLeft < 0)
      return { label: 'Trial vencido', tone: 'red', detail: `hace ${Math.abs(daysLeft)}d` }
    if (daysLeft <= 3)
      return { label: 'Trial', tone: 'amber', detail: `${daysLeft}d` }
    return { label: 'Trial', tone: 'blue', detail: `${daysLeft}d` }
  }
  return { label: 'Trial', tone: 'gray' }
}

const TONE_CLASSES: Record<UserStatus['tone'], string> = {
  green: 'bg-[var(--success)]/[0.12] text-[var(--success)] border-[var(--success)]/30',
  amber: 'bg-[var(--warn)]/[0.12] text-[var(--warn)] border-[var(--warn)]/30',
  red: 'bg-[var(--coral)]/[0.12] text-[var(--coral)] border-[var(--coral)]/30',
  blue: 'bg-[var(--info)]/[0.12] text-[var(--info)] border-[var(--info)]/30',
  gray: 'bg-[var(--overlay-2)] text-[var(--text2)] border-[var(--border2)]',
}

interface Props {
  users: AdminUser[]
}

export function AdminClient({ users }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [, startMutate] = useTransition()
  const [filter, setFilter] = useState<Filter>('todos')
  const [query, setQuery] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<AdminUser | null>(null)
  const [trialTarget, setTrialTarget] = useState<AdminUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const now = Date.now()
    let trial = 0
    let pro = 0
    let expired = 0
    let pending = 0
    for (const u of users) {
      if (!u.approved) {
        pending++
        continue
      }
      if (u.plan === 'pro') {
        const exp = u.proExpiresAt ? new Date(u.proExpiresAt).getTime() : Infinity
        if (exp < now) expired++
        else pro++
      } else if (u.plan === 'trial') {
        const exp = u.trialEndsAt ? new Date(u.trialEndsAt).getTime() : 0
        if (exp < now) expired++
        else trial++
      }
    }
    return { total: users.length, trial, pro, expired, pending }
  }, [users])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    return users.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.displayName ?? '').toLowerCase().includes(q)) {
        return false
      }
      switch (filter) {
        case 'todos':
          return true
        case 'trial':
          return u.plan === 'trial' && u.approved && (!u.trialEndsAt || new Date(u.trialEndsAt).getTime() >= now)
        case 'pro':
          return u.plan === 'pro' && u.approved && (!u.proExpiresAt || new Date(u.proExpiresAt).getTime() >= now)
        case 'vencidos': {
          if (!u.approved) return false
          if (u.plan === 'pro') {
            return u.proExpiresAt ? new Date(u.proExpiresAt).getTime() < now : false
          }
          if (u.plan === 'trial') {
            return u.trialEndsAt ? new Date(u.trialEndsAt).getTime() < now : false
          }
          return false
        }
        case 'sin_aprobar':
          return !u.approved
      }
    })
  }, [users, filter, query])

  const refresh = () => router.refresh()

  const handleBlock = async (u: AdminUser) => {
    const ok = await confirm({
      title: u.approved ? `¿Bloquear ${u.email}?` : `¿Aprobar ${u.email}?`,
      description: u.approved
        ? 'El usuario perderá acceso hasta que lo apruebes de nuevo.'
        : 'El usuario podrá iniciar sesión y usar la app.',
      confirmLabel: u.approved ? 'Bloquear' : 'Aprobar',
      tone: u.approved ? 'danger' : 'default',
    })
    if (!ok) return
    setError(null)
    startMutate(async () => {
      const r = await setApproved(u.id, !u.approved)
      if (r.error) setError(r.error)
      else refresh()
    })
  }

  const handleSetFree = async (u: AdminUser) => {
    const ok = await confirm({
      title: `¿Pasar ${u.email} a Free?`,
      description: 'El usuario pierde acceso a features Pro. No afecta sus datos.',
      confirmLabel: 'Pasar a Free',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    startMutate(async () => {
      const r = await setFree(u.id)
      if (r.error) setError(r.error)
      else refresh()
    })
  }

  const handleDelete = async (u: AdminUser) => {
    const ok = await confirm({
      title: `¿Eliminar permanentemente a ${u.email}?`,
      description:
        'Esto borra el usuario, su perfil, presupuesto, cuentas, transacciones, metas y recurrencias. No se puede deshacer.',
      confirmLabel: 'Eliminar usuario',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    startMutate(async () => {
      const r = await deleteUser(u.id)
      if (r.error) setError(r.error)
      else refresh()
    })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Total" value={stats.total} Icon={Users} />
          <Stat label="Trial" value={stats.trial} Icon={Clock} tone="blue" />
          <Stat label="Pro activos" value={stats.pro} Icon={CheckCircle2} tone="green" />
          <Stat label="Vencidos" value={stats.expired} Icon={AlertTriangle} tone="amber" />
          <Stat
            label="Sin aprobar"
            value={stats.pending}
            Icon={ShieldOff}
            tone={stats.pending > 0 ? 'red' : 'gray'}
          />
        </div>

        {/* Filters + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            ariaLabel="Filtro de usuarios"
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'trial', label: 'Trial' },
              { value: 'pro', label: 'Pro' },
              { value: 'vencidos', label: 'Vencidos' },
              { value: 'sin_aprobar', label: 'Sin aprobar' },
            ]}
          />
          <div className="relative w-full sm:w-[280px]">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por email o nombre"
              className="w-full !h-10 !pl-10 !pr-3 !text-[13px] !rounded-xl"
            />
          </div>
        </div>

        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        {/* Table */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1fr_140px_140px_140px] gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--muted2)] border-b border-[var(--border)]">
            <div>Usuario</div>
            <div>Estado</div>
            <div>Registro</div>
            <div>Último login</div>
            <div className="text-right">Acciones</div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center text-[14px] text-[var(--muted)]">
              Sin resultados.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((u) => {
                const status = statusFor(u)
                const initials =
                  (u.displayName ?? u.email)
                    .trim()
                    .split(/\s+/)
                    .map((s) => s[0]?.toUpperCase() ?? '')
                    .slice(0, 2)
                    .join('') || '?'
                return (
                  <li
                    key={u.id}
                    className="md:grid md:grid-cols-[2fr_1fr_140px_140px_140px] gap-4 px-5 py-4 items-center"
                  >
                    {/* User */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-[#0B0B0C] font-bold text-[12px] shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium truncate">
                          {u.displayName ?? '—'}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] truncate">
                          {u.email}
                        </div>
                        {!u.onboarded && (
                          <div className="text-[10px] text-[var(--warn)] mt-0.5">
                            Sin onboarding completo
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="mt-2 md:mt-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.12em] font-semibold border ${TONE_CLASSES[status.tone]}`}
                      >
                        {status.label}
                      </span>
                      {status.detail && (
                        <div className="text-[10px] text-[var(--muted)] mt-1">
                          {status.detail}
                        </div>
                      )}
                    </div>

                    {/* Signup */}
                    <div className="hidden md:block text-[12px] text-[var(--text2)]">
                      <div className="num tabular-nums">{fmtDate(u.signedUpAt)}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {fmtRelative(u.signedUpAt)}
                      </div>
                    </div>

                    {/* Last sign in */}
                    <div className="hidden md:block text-[12px] text-[var(--text2)]">
                      <div className="num tabular-nums">
                        {fmtDate(u.lastSignInAt)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {fmtRelative(u.lastSignInAt) ?? 'nunca'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 md:mt-0 flex items-center gap-1.5 justify-start md:justify-end flex-wrap">
                      <ActionButton
                        Icon={CreditCard}
                        label="Marcar pago"
                        onClick={() => setPaymentTarget(u)}
                      />
                      <ActionButton
                        Icon={CalendarPlus}
                        label="Extender trial"
                        onClick={() => setTrialTarget(u)}
                      />
                      {u.plan === 'pro' && (
                        <ActionButton
                          Icon={ArrowDownToLine}
                          label="Pasar a Free"
                          tone="danger"
                          onClick={() => handleSetFree(u)}
                        />
                      )}
                      <ActionButton
                        Icon={u.approved ? ShieldOff : Shield}
                        label={u.approved ? 'Bloquear' : 'Aprobar'}
                        tone={u.approved ? 'danger' : 'default'}
                        onClick={() => handleBlock(u)}
                      />
                      <ActionButton
                        Icon={Trash2}
                        label="Eliminar"
                        tone="danger"
                        onClick={() => handleDelete(u)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <PaymentDialog
        user={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onError={setError}
      />
      <TrialDialog
        user={trialTarget}
        onClose={() => setTrialTarget(null)}
        onError={setError}
      />
    </>
  )
}

function Stat({
  label,
  value,
  Icon,
  tone = 'gray',
}: {
  label: string
  value: number
  Icon: typeof Users
  tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue'
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`grid size-8 place-items-center rounded-lg ${
            tone === 'green'
              ? 'bg-[var(--success)]/[0.12] text-[var(--success)]'
              : tone === 'amber'
                ? 'bg-[var(--warn)]/[0.12] text-[var(--warn)]'
                : tone === 'red'
                  ? 'bg-[var(--coral)]/[0.12] text-[var(--coral)]'
                  : tone === 'blue'
                    ? 'bg-[var(--info)]/[0.12] text-[var(--info)]'
                    : 'bg-[var(--overlay-2)] text-[var(--text2)]'
          }`}
        >
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold">
        {label}
      </div>
      <div className="text-[20px] font-bold num tabular-nums">{value}</div>
    </div>
  )
}

function ActionButton({
  Icon,
  label,
  onClick,
  tone = 'default',
}: {
  Icon: typeof Users
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-colors ${
        tone === 'danger'
          ? 'text-[var(--coral)] hover:bg-[rgba(255,122,89,0.10)]'
          : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)]'
      }`}
    >
      <Icon size={12} strokeWidth={2} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}

function PaymentDialog({
  user,
  onClose,
  onError,
}: {
  user: AdminUser | null
  onClose: () => void
  onError: (err: string | null) => void
}) {
  const router = useRouter()
  const [months, setMonths] = useState(1)
  const [pending, startMutate] = useTransition()

  if (!user) return null

  const handleConfirm = () => {
    onError(null)
    startMutate(async () => {
      const r = await recordPayment(user.id, months)
      if (r.error) {
        onError(r.error)
        onClose()
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Modal isOpen={true} onClose={onClose} variant="center" size="sm">
      <div className="p-6 space-y-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Marcar pago recibido
          </div>
          <h2 className="text-[18px] font-bold mt-1 leading-tight">{user.email}</h2>
          <p className="text-[12px] text-[var(--muted)] mt-1">
            Activa Pro y extiende la fecha de vencimiento.
          </p>
        </div>

        <div>
          <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 block">
            Meses pagados
          </label>
          <div className="grid grid-cols-4 gap-2 p-1 bg-[var(--bg)] rounded-xl">
            {[1, 3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  months === m
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">
            Se suma a la fecha actual de expiración (no se sobreescribe).
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? 'Guardando...' : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function TrialDialog({
  user,
  onClose,
  onError,
}: {
  user: AdminUser | null
  onClose: () => void
  onError: (err: string | null) => void
}) {
  const router = useRouter()
  const [days, setDays] = useState(7)
  const [pending, startMutate] = useTransition()

  if (!user) return null

  const handleConfirm = () => {
    onError(null)
    startMutate(async () => {
      const r = await extendTrial(user.id, days)
      if (r.error) {
        onError(r.error)
        onClose()
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Modal isOpen={true} onClose={onClose} variant="center" size="sm">
      <div className="p-6 space-y-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
            Extender trial
          </div>
          <h2 className="text-[18px] font-bold mt-1 leading-tight">{user.email}</h2>
        </div>

        <div>
          <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 block">
            Días extra
          </label>
          <div className="grid grid-cols-4 gap-2 p-1 bg-[var(--bg)] rounded-xl">
            {[7, 14, 31, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  days === d
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? 'Guardando...' : 'Extender'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
