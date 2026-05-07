'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  inviteToBudget,
  removeMember,
  changeMemberRole,
  revokeInvitation,
} from './actions'

export interface ListMember {
  id: string
  userId: string
  role: 'owner' | 'editor' | 'viewer'
  email: string | null
  displayName: string | null
  joinedAt: string | null
  isYou: boolean
}

export interface ListInvite {
  id: string
  email: string
  role: 'editor' | 'viewer'
  expiresAt: string
  createdAt: string
}

interface Props {
  budgetName: string | null
  ownerId: string
  members: ListMember[]
  invitations: ListInvite[]
}

const formatDate = (iso: string | null) => {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const roleLabel = (role: 'owner' | 'editor' | 'viewer') => {
  switch (role) {
    case 'owner':
      return 'Dueño'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Solo ver'
  }
}

export function FamiliaClient({ budgetName, members, invitations }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleInvite = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const r = await inviteToBudget({ email, role })
      if ('error' in r) {
        setError(r.error ?? 'Error al invitar')
        return
      }
      setSuccess(`Enviamos la invitación a ${email}`)
      setEmail('')
      router.refresh()
      window.setTimeout(() => setSuccess(null), 4000)
    })
  }

  const handleRemove = async (m: ListMember) => {
    const ok = await confirm({
      title: `¿Quitar a ${m.displayName ?? m.email ?? 'este miembro'}?`,
      description:
        'Pierde acceso al presupuesto inmediatamente. Sus transacciones quedan intactas.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!ok) return
    startTransition(async () => {
      await removeMember(m.id)
      router.refresh()
    })
  }

  const handleRoleChange = (m: ListMember, next: 'editor' | 'viewer') => {
    if (m.role === next) return
    startTransition(async () => {
      await changeMemberRole(m.id, next)
      router.refresh()
    })
  }

  const handleRevoke = async (inv: ListInvite) => {
    const ok = await confirm({
      title: '¿Cancelar invitación?',
      description: `Cancelas la invitación a ${inv.email}. Puedes volver a invitarlo cuando quieras.`,
      confirmLabel: 'Cancelar invitación',
      tone: 'danger',
    })
    if (!ok) return
    startTransition(async () => {
      await revokeInvitation(inv.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-7 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Familia
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          Comparte tu <span className="gradient-text">presupuesto</span>.
        </h1>
        <p className="text-[var(--text2)] text-[14px] leading-relaxed max-w-xl">
          Invita a tu pareja, hijos o roommate a ver y editar tu presupuesto. Cada quien registra sus gastos y todos ven el mismo plan.
        </p>
      </div>

      {/* Invite form */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} strokeWidth={2.2} className="text-[var(--brand-text)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Invitar a alguien</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="!text-[14px] !py-3 !px-4 !rounded-xl"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="!text-[14px] !py-3 !px-4 !rounded-xl appearance-none cursor-pointer"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Solo ver</option>
          </select>
          <button
            type="button"
            onClick={handleInvite}
            disabled={pending || !email.trim()}
            className="h-12 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 transition-[filter]"
          >
            <Mail size={14} strokeWidth={2.4} />
            Invitar
          </button>
        </div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          Editor puede asignar dinero, agregar transacciones y editar metas. Solo ver puede consultar pero no modificar.
        </p>
        {error && (
          <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
            <AlertCircle size={14} strokeWidth={2.2} className="text-[var(--coral-text)] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-[var(--success)]/40 bg-[rgba(61,220,151,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
            <CheckCircle2 size={14} strokeWidth={2.2} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Clock size={14} strokeWidth={2.2} className="text-[var(--warn-text)]" />
            <h2 className="text-[14px] font-semibold text-[var(--text)]">
              Invitaciones pendientes
            </h2>
          </header>
          <ul className="divide-y divide-[var(--border)]">
            {invitations.map((inv) => (
              <li key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0">
                  <Mail size={14} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--text)] truncate">{inv.email}</div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">
                    {roleLabel(inv.role)} · expira {formatDate(inv.expiresAt) ?? '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv)}
                  disabled={pending}
                  className="text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)] w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                  aria-label="Cancelar invitación"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Members list */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Users size={14} strokeWidth={2.2} className="text-[var(--brand-text)]" />
          <h2 className="text-[14px] font-semibold text-[var(--text)]">
            Miembros {budgetName ? `de ${budgetName}` : ''}
          </h2>
        </header>
        <ul className="divide-y divide-[var(--border)]">
          {members.map((m) => (
            <li key={m.id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center shrink-0">
                {m.role === 'owner' ? (
                  <Crown size={14} strokeWidth={2} className="text-[var(--warn-text)]" />
                ) : m.role === 'viewer' ? (
                  <Eye size={14} strokeWidth={2} />
                ) : (
                  <Users size={14} strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[var(--text)] truncate">
                  {m.displayName ?? m.email ?? 'Sin nombre'}
                  {m.isYou && <span className="text-[var(--muted)] ml-2">(tú)</span>}
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5">
                  {m.email && m.email !== m.displayName ? m.email + ' · ' : ''}
                  {roleLabel(m.role)}
                  {m.joinedAt && ` · se unió ${formatDate(m.joinedAt)}`}
                </div>
              </div>
              {m.role !== 'owner' && (
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={m.role}
                    onChange={(e) =>
                      handleRoleChange(m, e.target.value as 'editor' | 'viewer')
                    }
                    disabled={pending}
                    className="!text-[12px] !py-1.5 !px-2 !rounded-lg appearance-none cursor-pointer"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Solo ver</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    disabled={pending}
                    className="text-[var(--muted)] hover:text-[var(--coral-text)] hover:bg-[rgba(255,122,89,0.10)] w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    aria-label="Quitar miembro"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
