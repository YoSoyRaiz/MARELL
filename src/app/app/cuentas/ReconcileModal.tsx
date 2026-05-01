'use client'

import { useEffect, useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Scale, CheckCircle2 } from 'lucide-react'
import { MoneyInput } from '@/app/onboarding/wizard/components/MoneyInput'
import { reconcileAccount } from './actions'
import { useFormatMoney } from '../CurrencyProvider'

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

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconcile-title"
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)] inline-flex items-center gap-2">
              <Scale size={12} strokeWidth={2.4} />
              Reconciliar
            </div>
            <h2
              id="reconcile-title"
              className="text-[18px] font-bold mt-1 leading-tight tracking-tight"
            >
              Cuadra <span className="gradient-text">{accountName}</span> con tu banco
            </h2>
            <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              Pon el balance que ves en tu app del banco. Cerramos cualquier diferencia con un ajuste y bloqueamos lo que ya pasó.
            </p>
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

        {done ? (
          <>
            <div className="px-6 py-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(61,220,151,0.10)] text-[var(--brand-2)] flex items-center justify-center mx-auto">
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
            <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end bg-white/[0.01]">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter]"
              >
                Listo
              </button>
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
                        className="text-[var(--success)] shrink-0 mt-0.5"
                      />
                      <span>Cuadra perfecto. Vamos a bloquear todo lo que ya pasó.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        size={14}
                        strokeWidth={2.2}
                        className="text-[var(--warn)] shrink-0 mt-0.5"
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
                    className="text-[var(--coral)] shrink-0 mt-0.5"
                  />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-white/[0.01]">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-xl transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={actual === null || pending}
                className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center gap-2 transition-[filter] disabled:opacity-50 disabled:pointer-events-none"
              >
                {pending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
                    Reconciliando...
                  </>
                ) : (
                  'Reconciliar ahora'
                )}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

