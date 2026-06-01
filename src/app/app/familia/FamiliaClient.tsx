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
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { IconBadge } from '@/components/ui/IconBadge'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Card } from '@/components/ui/Card'
import {
  inviteToBudget,
  removeMember,
  changeMemberRole,
  revokeInvitation,
} from './actions'
import { endClientRelationship } from '../clientes/actions'

export interface ListMember {
  id: string
  userId: string
  role: 'owner' | 'editor' | 'viewer' | 'auditor'
  email: string | null
  displayName: string | null
  joinedAt: string | null
  isYou: boolean
  /** Última vez que este miembro accedió al budget (de
   *  budget_access_log). Solo poblado para roles que NO son owner. */
  lastAccessAt?: string | null
  /** ID de la fila agency_relationships si role='auditor'. Necesario
   *  para revocar el acceso. */
  agencyRelationshipId?: string | null
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

const roleLabel = (role: 'owner' | 'editor' | 'viewer' | 'auditor') => {
  switch (role) {
    case 'owner':
      return 'Dueño'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Solo ver'
    case 'auditor':
      return 'Auditor'
  }
}

const formatRelative = (iso: string | null) => {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  return formatDate(iso)
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

  const handleRevokeAuditor = async (m: ListMember) => {
    if (!m.agencyRelationshipId) return
    const ok = await confirm({
      title: `¿Revocar acceso de ${m.displayName ?? m.email ?? 'este auditor'}?`,
      description:
        'Pierde acceso inmediato a tu presupuesto. Su rol queda registrado en el historial. Puedes volver a darle acceso si te invita de nuevo.',
      confirmLabel: 'Revocar acceso',
      tone: 'danger',
    })
    if (!ok) return
    startTransition(async () => {
      await endClientRelationship(m.agencyRelationshipId!)
      router.refresh()
    })
  }

  return (
    <div className="space-y-7 max-w-3xl">
      <PageHeader
        eyebrow="Familia"
        description="Invita a tu pareja, hijos o roommate a ver y editar tu presupuesto. Cada quien registra sus gastos y todos ven el mismo plan."
      >
        Comparte tu <span className="gradient-text">presupuesto</span>.
      </PageHeader>

      {/* Invite form */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} strokeWidth={2.2} className="text-[var(--brand-text)]" />
          <h2 className="text-emph font-semibold text-[var(--text)]">Invitar a alguien</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="!text-body !py-3 !px-4 !rounded-xl"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="!text-body !py-3 !px-4 !rounded-xl appearance-none cursor-pointer"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Solo ver</option>
          </select>
          <button
            type="button"
            onClick={handleInvite}
            disabled={pending || !email.trim()}
            className="h-12 px-5 gradient-bg text-[#0B0B0C] font-semibold text-body-sm rounded-xl glow-on-hover hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 transition-[filter]"
          >
            <Mail size={14} strokeWidth={2.4} />
            Invitar
          </button>
        </div>
        <p className="text-eyebrow text-[var(--muted)] leading-relaxed">
          Editor puede asignar dinero, agregar transacciones y editar metas. Solo ver puede consultar pero no modificar.
        </p>
        {error && (
          <AlertBanner tone="danger" size="sm">
            {error}
          </AlertBanner>
        )}
        {success && (
          <AlertBanner tone="success" size="sm">
            {success}
          </AlertBanner>
        )}
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card as="section" className="overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Clock size={14} strokeWidth={2.2} className="text-[var(--warn-text)]" />
            <h2 className="text-body font-semibold text-[var(--text)]">
              Invitaciones pendientes
            </h2>
          </header>
          <ul className="divide-y divide-[var(--border)]">
            {invitations.map((inv) => (
              <li key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <IconBadge>
                  <Mail size={14} strokeWidth={2} />
                </IconBadge>
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm text-[var(--text)] truncate">{inv.email}</div>
                  <div className="text-eyebrow text-[var(--muted)] mt-0.5">
                    {roleLabel(inv.role)} · expira {formatDate(inv.expiresAt) ?? '—'}
                  </div>
                </div>
                <IconButton
                  size="sm"
                  tone="danger"
                  onClick={() => handleRevoke(inv)}
                  disabled={pending}
                  aria-label="Cancelar invitación"
                  className="shrink-0"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Auditores con acceso — sección dedicada para transparencia.
          Solo aparece si hay al menos un auditor en el budget. */}
      {members.some((m) => m.role === 'auditor') && (
        <Card as="section" className="overflow-hidden">
          <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <ShieldAlert size={14} strokeWidth={2.2} className="text-[var(--info-text)]" />
            <h2 className="text-body font-semibold text-[var(--text)]">
              Auditores con acceso
            </h2>
          </header>
          <ul className="divide-y divide-[var(--border)]">
            {members
              .filter((m) => m.role === 'auditor')
              .map((m) => (
                <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                  <IconBadge>
                    <ShieldAlert size={14} strokeWidth={2} className="text-[var(--info-text)]" />
                  </IconBadge>
                  <div className="flex-1 min-w-0">
                    <div className="text-body-sm text-[var(--text)] truncate">
                      {m.displayName ?? m.email ?? 'Sin nombre'}
                    </div>
                    <div className="text-eyebrow text-[var(--muted)] mt-0.5">
                      {m.email && m.email !== m.displayName ? m.email + ' · ' : ''}
                      Auditor (solo lectura)
                      {m.joinedAt && ` · desde ${formatDate(m.joinedAt)}`}
                    </div>
                    <div className="text-tiny text-[var(--muted2)] mt-1 inline-flex items-center gap-1.5">
                      <Clock size={10} strokeWidth={2.2} />
                      {m.lastAccessAt
                        ? `Último acceso ${formatRelative(m.lastAccessAt)}`
                        : 'Aún no ha accedido'}
                    </div>
                  </div>
                  {m.agencyRelationshipId && (
                    <button
                      type="button"
                      onClick={() => handleRevokeAuditor(m)}
                      disabled={pending}
                      className="text-meta font-medium text-[var(--coral-text)] hover:underline underline-offset-4 disabled:opacity-50 disabled:pointer-events-none shrink-0"
                    >
                      Revocar acceso
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </Card>
      )}

      {/* Members list (excluyendo auditores que tienen su propia
          sección arriba para transparencia explícita). */}
      <Card as="section" className="overflow-hidden">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Users size={14} strokeWidth={2.2} className="text-[var(--brand-text)]" />
          <h2 className="text-body font-semibold text-[var(--text)]">
            Miembros {budgetName ? `de ${budgetName}` : ''}
          </h2>
        </header>
        <ul className="divide-y divide-[var(--border)]">
          {members.filter((m) => m.role !== 'auditor').map((m) => (
            <li key={m.id} className="px-5 py-3 flex items-center gap-3">
              <IconBadge>
                {m.role === 'owner' ? (
                  <Crown size={14} strokeWidth={2} className="text-[var(--warn-text)]" />
                ) : m.role === 'viewer' ? (
                  <Eye size={14} strokeWidth={2} />
                ) : (
                  <Users size={14} strokeWidth={2} />
                )}
              </IconBadge>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-[var(--text)] truncate">
                  {m.displayName ?? m.email ?? 'Sin nombre'}
                  {m.isYou && <span className="text-[var(--muted)] ml-2">(tú)</span>}
                </div>
                <div className="text-eyebrow text-[var(--muted)] mt-0.5">
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
                    className="!text-meta !py-1.5 !px-2 !rounded-lg appearance-none cursor-pointer"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Solo ver</option>
                  </select>
                  <IconButton
                    size="sm"
                    tone="danger"
                    onClick={() => handleRemove(m)}
                    disabled={pending}
                    aria-label="Quitar miembro"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
