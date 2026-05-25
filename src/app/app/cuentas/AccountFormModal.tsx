'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { AccountTypeSelect } from '@/app/onboarding/wizard/components/AccountTypeSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { ModalHeader, ModalTitle } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'
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
  currency?: 'DOP' | 'USD'
  interestRateApr?: number | null
  cycleCloseDay?: number | null
}

const CC_TYPES: AccountType[] = [
  'credit_card',
  'line_of_credit',
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
]

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
  const [currency, setCurrency] = useState<'DOP' | 'USD'>('DOP')
  const [interestRate, setInterestRate] = useState<string>('')
  const [cycleCloseDay, setCycleCloseDay] = useState<string>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initial) {
      setName(initial.name)
      setType(initial.type)
      // Show absolute value in the input; sign is re-applied by the action.
      setBalance(Math.abs(initial.balance))
      setCurrency(initial.currency ?? 'DOP')
      setInterestRate(
        initial.interestRateApr != null ? String(initial.interestRateApr) : '',
      )
      setCycleCloseDay(
        initial.cycleCloseDay != null ? String(initial.cycleCloseDay) : '',
      )
      setNote(initial.note ?? '')
    } else {
      setName('')
      setType(null)
      setBalance(null)
      setCurrency('DOP')
      setInterestRate('')
      setCycleCloseDay('')
      setNote('')
    }
    setError(null)
  }, [isOpen, mode, initial])

  const valid = name.trim().length > 0 && type !== null && balance !== null

  const handleSubmit = () => {
    if (!valid || balance === null || type === null) return
    setError(null)
    startTransition(async () => {
      const aprNum = interestRate.trim() === '' ? null : Number(interestRate)
      const cycleNum = cycleCloseDay.trim() === '' ? null : Number(cycleCloseDay)
      if (aprNum !== null && (!Number.isFinite(aprNum) || aprNum < 0 || aprNum > 999)) {
        setError('Tasa de interés inválida (0–999%)')
        return
      }
      if (
        cycleNum !== null &&
        (!Number.isInteger(cycleNum) || cycleNum < 1 || cycleNum > 31)
      ) {
        setError('Día de corte inválido (1–31)')
        return
      }
      const payload = {
        name,
        type,
        balance,
        note: note || null,
        currency,
        interestRateApr: aprNum,
        cycleCloseDay: cycleNum,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="account-form-title"
      variant="center"
    >
        <ModalHeader onClose={onClose}>
          <ModalTitle
            id="account-form-title"
            eyebrow={isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
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
          </ModalTitle>
        </ModalHeader>

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

          <Field
            label="Moneda"
            hint={currency === 'USD' ? 'se convierte a RD$ usando la tasa BCRD' : 'cuenta en pesos dominicanos'}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrency('DOP')}
                className={`h-11 rounded-xl text-[13px] font-semibold transition-colors ${
                  currency === 'DOP'
                    ? 'gradient-bg text-[#0B0B0C] shadow-[0_4px_16px_rgba(61,220,151,0.18)]'
                    : 'bg-[var(--overlay-1)] text-[var(--text2)] hover:bg-[var(--overlay-2)] hover:text-[var(--text)]'
                }`}
              >
                RD$ Pesos (DOP)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`h-11 rounded-xl text-[13px] font-semibold transition-colors ${
                  currency === 'USD'
                    ? 'gradient-bg text-[#0B0B0C] shadow-[0_4px_16px_rgba(61,220,151,0.18)]'
                    : 'bg-[var(--overlay-1)] text-[var(--text2)] hover:bg-[var(--overlay-2)] hover:text-[var(--text)]'
                }`}
              >
                US$ Dólares (USD)
              </button>
            </div>
          </Field>

          {/* Credit-card / loan extras — only appear for relevant types */}
          {type !== null && CC_TYPES.includes(type) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tasa de interés" hint="APR %, opcional">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="999"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="36.50"
                  className="w-full !text-[14px] !py-3 !px-4 !rounded-xl tabular-nums num"
                />
              </Field>
              {type === 'credit_card' && (
                <Field label="Día de corte" hint="1–31, opcional">
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    max="31"
                    value={cycleCloseDay}
                    onChange={(e) => setCycleCloseDay(e.target.value)}
                    placeholder="20"
                    className="w-full !text-[14px] !py-3 !px-4 !rounded-xl tabular-nums num"
                  />
                </Field>
              )}
            </div>
          )}

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
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--overlay-1)] hover:bg-[var(--overlay-1)] border border-[var(--border)] hover:border-[var(--border3)] text-[13px] text-[var(--text)] transition-colors disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  {initial.closed ? (
                    <>
                      <ArchiveRestore size={14} strokeWidth={2} className="text-[var(--brand-text)]" />
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
                className="w-full inline-flex items-center justify-between px-4 py-3 rounded-xl text-[13px] transition-colors disabled:opacity-60 bg-[var(--overlay-1)] hover:bg-[rgba(255,122,89,0.10)] border border-[var(--border)] hover:border-[var(--coral)]/40 text-[var(--text2)] hover:text-[var(--coral-text)]"
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
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral-text)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--overlay-1)]">
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
            onClick={handleSubmit}
            disabled={!valid || pending}
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
          </Button>
        </footer>
    </Modal>
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
