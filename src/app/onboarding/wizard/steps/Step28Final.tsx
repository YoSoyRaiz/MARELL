'use client'

import { useState, useTransition } from 'react'
import { HandHeart, ArrowRight, AlertCircle } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { completeOnboarding } from '@/app/onboarding/actions'

export function Step28Final() {
  const answers = useOnboardingStore((s) => s.answers)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      const result = await completeOnboarding(answers)
      if (result && 'error' in result && result.error) {
        setError(result.error)
      }
      // On success the server action redirects, so we don't reach here.
    })
  }

  return (
    <div className="space-y-7 pt-4">
      <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center text-[#0B0B0C] [&>svg]:w-7 [&>svg]:h-7">
        <HandHeart strokeWidth={2.2} />
      </div>
      <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
        Estamos aquí cuando lo <span className="gradient-text">necesites</span>.
      </h1>
      <p className="text-[var(--text2)] text-[18px] leading-relaxed max-w-lg">
        Guías, comunidad, y soporte de personas que también manejan su dinero con MARELL. No estás
        solo en esto.
      </p>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="w-full sm:w-auto h-[56px] px-9 gradient-bg text-[#0B0B0C] font-semibold text-[16px] rounded-2xl glow-on-hover hover:brightness-105 active:scale-[.99] transition-[filter,transform] inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
        >
          {pending ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
              Creando tu plan...
            </>
          ) : (
            <>
              Crear mi plan
              <ArrowRight size={18} strokeWidth={2.4} />
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} strokeWidth={2} className="text-[var(--coral)] shrink-0 mt-0.5" />
          <div className="text-[14px] text-[var(--text)] leading-relaxed">
            <div className="font-medium">No pudimos crear tu plan.</div>
            <div className="text-[var(--text2)] mt-1">{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}
