'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCw, ArrowRight } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Catches uncaught render-side exceptions in the /app subtree. Without
 * this, a single bad query or undefined access would surface Next's
 * default error page (or worse, leak a stack trace in production).
 *
 * The `digest` is Next's anonymous error id — server logs the full
 * trace under that digest, so support can correlate without exposing
 * details to the user.
 */
export default function AppError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Surface the error in the browser console for the developer +
    // ride along to whatever logging tool is wired up later.
    console.error('[app-error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--coral)]/30 bg-[rgba(255,122,89,0.05)] p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[rgba(255,122,89,0.10)] text-[var(--coral-text)] flex items-center justify-center mx-auto">
          <AlertCircle size={26} strokeWidth={2.2} />
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-[var(--text)]">
          Algo se rompió en esta página
        </h1>
        <p className="text-[13px] text-[var(--text2)] leading-relaxed">
          Ya guardamos el detalle del error para revisarlo. Si el problema
          persiste, escríbenos a{' '}
          <a
            href="mailto:hola@marell.app"
            className="text-[var(--brand-text)] underline underline-offset-4"
          >
            hola@marell.app
          </a>
          {error.digest && (
            <>
              {' '}
              con el código <span className="font-mono text-[12px]">{error.digest}</span>.
            </>
          )}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 text-[13px] font-semibold rounded-xl bg-[var(--overlay-1)] hover:bg-[var(--overlay-3)] text-[var(--text)] transition-colors inline-flex items-center gap-2"
          >
            <RotateCw size={13} strokeWidth={2.4} />
            Intentar de nuevo
          </button>
          <Link
            href="/app"
            className="h-10 px-4 text-[13px] font-semibold rounded-xl gradient-bg text-[#0B0B0C] hover:brightness-105 transition-[filter] inline-flex items-center gap-2"
          >
            Ir al resumen
            <ArrowRight size={13} strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </div>
  )
}
