'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, X } from 'lucide-react'

export type ConfirmTone = 'danger' | 'default'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

interface InternalState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmCtx = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmCtx)
  if (!fn) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>')
  }
  return fn
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve })
      }),
    [],
  )

  const close = useCallback(
    (ok: boolean) => {
      if (!state) return
      state.resolve(ok)
      setState(null)
    },
    [state],
  )

  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    // Focus confirm button on next tick
    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      window.clearTimeout(id)
    }
  }, [state, close])

  const tone = state?.tone ?? 'danger'
  const isDanger = tone === 'danger'
  const confirmLabel = state?.confirmLabel ?? 'Eliminar'
  const cancelLabel = state?.cancelLabel ?? 'Cancelar'

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
            onClick={() => close(false)}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={state.description ? 'confirm-dialog-desc' : undefined}
            className="relative w-full max-w-sm rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step overflow-hidden"
          >
            <button
              type="button"
              onClick={() => close(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 w-8 h-8 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors"
            >
              <X size={16} strokeWidth={2.2} />
            </button>

            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isDanger
                      ? 'bg-[rgba(255,122,89,0.12)] text-[var(--coral)]'
                      : 'bg-white/[0.05] text-[var(--text2)]'
                  }`}
                >
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h2
                    id="confirm-dialog-title"
                    className="text-[17px] font-bold leading-tight tracking-tight pr-6"
                  >
                    {state.title}
                  </h2>
                  {state.description && (
                    <p
                      id="confirm-dialog-desc"
                      className="text-[13px] text-[var(--text2)] leading-relaxed mt-2"
                    >
                      {state.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2 bg-white/[0.01]">
              <button
                type="button"
                onClick={() => close(false)}
                className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-lg transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`h-10 px-5 font-semibold text-[13px] rounded-xl transition-[filter,background-color] inline-flex items-center gap-2 ${
                  isDanger
                    ? 'bg-[var(--coral)] text-[#0B0B0C] hover:brightness-110 active:brightness-95'
                    : 'gradient-bg text-[#0B0B0C] glow-on-hover hover:brightness-105'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
