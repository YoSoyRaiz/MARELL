'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Scale, CheckCircle2 } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { reconcileAccount } from './actions'
import { useFormatMoney } from '../CurrencyProvider'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ModalHeader, ModalTitle } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'

interface ReconcileModalProps {
  isOpen: boolean
  onClose: () => void
  accountId: string
  accountName: string
  currentBalance: number
  /** When true, the modal asks for "what you owe" (positive) rather
      than "what you have", and the diff is interpreted accordingly. */
  isDebt?: boolean
}

export function ReconcileModal({
  isOpen,
  onClose,
  accountId,
  accountName,
  currentBalance,
  isDebt = false,
}: ReconcileModalProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const [pending, startTransition] = useTransition()
  const [actual, setActual] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    adjustment: number
    locked: number
  } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setActual(null)
    setError(null)
    setDone(null)
  }, [isOpen])


  // For debt accounts the user enters what they owe (positive). We
  // compare that to the absolute value of the stored balance so the
  // "matches?" check works regardless of sign convention.
  const displayedCurrent = isDebt ? Math.abs(currentBalance) : currentBalance
  const diff = actual !== null ? actual - displayedCurrent : 0
  const matches = actual !== null && Math.abs(diff) < 0.005

  const handleSubmit = () => {
    if (actual === null) return
    setError(null)
    startTransition(async () => {
      const r = await reconcileAccount(accountId, actual)
      if (r.error) {
        setError(r.error)
        return
      }
      setDone({
        adjustment: r.adjustmentAmount ?? 0,
        locked: r.reconciledCount ?? 0,
      })
      router.refresh()
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="reconcile-title"
      maxHeight="92vh"
      scrollable
    >
      <ModalHeader onClose={onClose}>
          <ModalTitle
            id="reconcile-title"
            size="compact"
            eyebrow={
              <span className="inline-flex items-center gap-2">
                <Scale size={12} strokeWidth={2.4} />
                Reconciliar
              </span>
            }
            description="Pon el balance que ves en tu app del banco. Cerramos cualquier diferencia con un ajuste y bloqueamos lo que ya pasó."
          >
            Cuadra <span className="gradient-text">{accountName}</span> con tu banco
          </ModalTitle>
        </ModalHeader>

        {done ? (
          <>
            <div className="px-6 py-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} strokeWidth={2} />
              </div>
              <div className="text-[15px] text-[var(--text)] font-semibold">
                Cuenta reconciliada
              </div>
              <div className="text-[13px] text-[var(--muted)] leading-relaxed">
                {done.adjustment !== 0 && (
                  <div className="num tabular-nums">
                    Ajuste: <span className="text-[var(--text2)]">{fmtMoney(done.adjustment)}</span>
                  </div>
                )}
                <div>
                  {done.locked} {done.locked === 1 ? 'transacción bloqueada' : 'transacciones bloqueadas'}
                </div>
              </div>
            </div>
            <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end bg-[var(--overlay-1)]">
              <Button
                type="button"
                variant="gradient"
                size="tight"
                onClick={onClose}
              >
                Listo
              </Button>
            </footer>
          </>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] font-semibold mb-1">
                  {isDebt ? 'Lo que MARELL dice que debes' : 'Balance actual en MARELL'}
                </div>
                <div className="text-[18px] font-bold tabular-nums num text-[var(--text)]">
                  {fmtMoney(displayedCurrent)}
                </div>
              </div>

              <div>
                <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 block">
                  {isDebt ? 'Lo que realmente debes según tu banco' : 'Balance según tu banco'}
                </label>
                <MoneyInput value={actual} onChange={setActual} placeholder="0.00" />
                {isDebt && (
                  <p className="text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
                    Pon el saldo pendiente como número positivo (lo que aparece en el estado).
                  </p>
                )}
              </div>

              {actual !== null && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-[12px] flex items-start gap-2 ${
                    matches
                      ? 'border-[var(--success)]/40 bg-[rgba(61,220,151,0.06)] text-[var(--text)]'
                      : 'border-[var(--warn)]/40 bg-[rgba(245,200,66,0.06)] text-[var(--text)]'
                  }`}
                >
                  {matches ? (
                    <>
                      <CheckCircle2
                        size={14}
                        strokeWidth={2.2}
                        className="text-[var(--brand-text)] shrink-0 mt-0.5"
                      />
                      <span>Cuadra perfecto. Vamos a bloquear todo lo que ya pasó.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        size={14}
                        strokeWidth={2.2}
                        className="text-[var(--warn-text)] shrink-0 mt-0.5"
                      />
                      <span className="num tabular-nums">
                        Diferencia: {fmtMoney(diff)}. Crearemos un ajuste sin categoría con esa cantidad.
                      </span>
                    </>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-3 py-2 flex items-start gap-2 text-[12px] text-[var(--text)]">
                  <AlertCircle
                    size={14}
                    strokeWidth={2.2}
                    className="text-[var(--coral-text)] shrink-0 mt-0.5"
                  />
                  <span>{error}</span>
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
                disabled={actual === null || pending}
              >
                {pending ? (
                  <>
                    <Spinner />
                    Reconciliando...
                  </>
                ) : (
                  'Reconciliar ahora'
                )}
              </Button>
            </footer>
          </>
        )}
    </Modal>
  )
}

