'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useOnboardingStore } from './store'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import type { StepDef } from './types'

export function WizardShell({ steps }: { steps: StepDef[] }) {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const answers = useOnboardingStore((s) => s.answers)
  const next = useOnboardingStore((s) => s.next)
  const back = useOnboardingStore((s) => s.back)

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const safeIndex = Math.min(Math.max(currentStep, 0), steps.length - 1)
  const step = steps[safeIndex]
  const total = steps.length
  const progress = ((safeIndex + 1) / total) * 100
  const canContinue = hydrated && (step.canContinue ? step.canContinue(answers) : true)
  const StepComponent = step.Component

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-white/[0.04] sticky top-0 z-20">
        <div
          className="h-full gradient-bg transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header — back left, logo centered, X right */}
      <header className="relative px-6 py-5">
        <button
          type="button"
          onClick={back}
          disabled={safeIndex === 0}
          aria-label="Atrás"
          className="absolute left-6 top-1/2 -translate-y-1/2 text-[13px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
        >
          <ArrowLeft size={14} strokeWidth={2.2} />
          <span className="hidden sm:inline">Atrás</span>
        </button>

        <div className="flex justify-center">
          <Logo height={42} />
        </div>

        <Link
          href="/"
          aria-label="Cerrar y volver al inicio"
          className="absolute right-6 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.05] transition-colors"
        >
          <X size={18} strokeWidth={2} />
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 pt-6 pb-36">
        <div className={`${step.wide ? 'max-w-5xl' : 'max-w-2xl'} w-full`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-5">
            {step.phase}
          </div>
          {hydrated ? (
            <div key={step.id} className="animate-step">
              <StepComponent />
            </div>
          ) : (
            <div className="h-[420px]" aria-hidden />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 pt-16 pb-6 px-6 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/90 to-transparent pointer-events-none">
        <div className={`${step.wide ? 'max-w-5xl' : 'max-w-2xl'} mx-auto flex items-center justify-between gap-4 pointer-events-auto`}>
          <span className="text-[12px] text-[var(--muted)] tabular-nums">
            <span className="text-[var(--text2)] font-medium">{safeIndex + 1}</span>
            <span className="text-[var(--muted2)]"> / {total}</span>
          </span>
          <div className="flex items-center gap-2">
            {step.showSkip && safeIndex < total - 1 && (
              <button
                type="button"
                onClick={next}
                className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] px-3 py-2 rounded-lg transition-colors"
              >
                Saltar
              </button>
            )}
            <Button
              variant="gradient"
              size="lg"
              onClick={next}
              disabled={!canContinue}
              iconRight={<ArrowRight size={16} strokeWidth={2.2} />}
            >
              {step.primaryLabel ?? 'Continuar'}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
