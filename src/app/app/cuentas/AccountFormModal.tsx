'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { AccountTypeSelect } from '@/app/onboarding/wizard/components/AccountTypeSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { AccountType } from '@/app/onboarding/wizard/types'
import {
  createAccount,
  updateAccount,
  deleteAccount,
  setAccountClosed,
} from './actions'

export interface InitialAccount {
  id: string
  name: string
  type: AccountType
  balance: number // raw (negative for debts)
  note: string | null
  closed: boolean
}

interface AccountFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  initial?: InitialAccount
}

export function AccountFormModal({ isOpen, onClose, mode, initial }: AccountFormModalProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setName(initial.name)
      setType(initial.type)
      // Show absolute value in the input; sign is re-applied by the action.
      setBalance(Math.abs(initial.balance))
      setNote(initial.note ?? '')
    } else {
      setName('')
      setType(null)
      setBalance(null)
      setNote('')
    }
    setError(null)
  }, [isOpen, mode, initial])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const valid = name.trim().length > 0 && type !== null && balance !== null

  const handleSubmit = () => {
    if (!valid || balance === null || type === null) return
    setError(null)
    startTransition(async () => {
      const payload = {
        name,
        type,
        balance,
        note: note || null,
      }
      const result =
        mode === 'edit' && initial
          ? await updateAccount({ id: initial.id, ...payload })
          : await createAccount(payload)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const handleToggleClosed = () => {
    if (!initial) return
    setError(null)
    startTransition(async () => {
      const result = await setAccountClosed(initial.id, !initial.closed)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const handleDelete = async () => {
    if (!initial) return
    const ok = await confirm({
      title: `¿Eliminar la cuenta "${initial.name}"?`,
      description:
        'Esto borra la cuenta y todas sus transacciones permanentemente. No se puede deshacer.',
      confirmLabel: 'Eliminar permanentemente',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount(initial.id)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const isEdit = mode === 'edit'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              {isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
            </div>
            <h2
              id="account-form-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              {isEdit ? (
                <>
                  Edita los <span className="gradient-text">detalles</span>
                </>
              ) : (
                <>
                  Agrega una <span className="gradient-text">cuenta</span>
                </>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Nombre">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banreservas Corriente"
              maxLength={50}
              className="w-full !text-[14px] !py-3 !px-4 !rounded-xl"
            />
          </Field>

          <Field label="Tipo de cuenta">
            <AccountTypeSelect value={type} onChange={setType} />
          </Field>

          <Field label="Balance actual" hint="el signo se ajusta según el tipo">
            <MoneyInput value={balance} onChange={setBalance} placeholder="0.00" />
          </Field>

          <Field label="Nota" hint="opcional">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalles adicionales (tasa de interés, número de cuenta, etc.)"
              maxLength={200}
              rows={2}
              className="w-full !text-[14px] !py-2.5 !px-4 !rounded-xl resize-none"
            />
          </Field>

          {/* Edit-only: archive + delete actions */}
          {isEdit && initial && (
            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <button
                type="button"
                onClick={handleToggleClosed}
                disabled={pending}
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-[var(--border)] hover:border-[var(--border3)] text-[13px] text-[var(--text)] transition-colors disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  {initial.closed ? (
                    <>
                      <ArchiveRestore size={14} strokeWidth={2} className="text-[var(--brand-2)]" />
                      Reabrir cuenta
                    </>
                  ) : (
                    <>
                      <Archive size={14} strokeWidth={2} className="text-[var(--text2)]" />
                      Cerrar cuenta
                    </>
                  )}
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  {initial.closed ? 'Está cerrada' : 'Mantiene historial'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl text-[13px] transition-colors disabled:opacity-60 bg-white/[0.02] hover:bg-[rgba(255,122,89,0.10)] border border-[var(--border)] hover:border-[var(--coral)]/40 text-[var(--text2)] hover:text-[var(--coral)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={14} strokeWidth={2} />
                  Eliminar cuenta
                </span>
                <span className="text-[11px] opacity-70">Borra transacciones</span>
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || pending}
            className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
                Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Agregar cuenta'
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
        {hint && <span className="text-[var(--muted)] font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
