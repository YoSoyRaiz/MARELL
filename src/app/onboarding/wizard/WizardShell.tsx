'use client'

import { useEffect, useState } from 'react'
import { useOnboardingStore } from './store'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import type { StepDef } from './types'

const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
)

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

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

      {/* Header */}
      <header className="px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo />
          <button
            type="button"
            onClick={back}
            disabled={safeIndex === 0}
            className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
          >
            <ArrowLeft />
            Atrás
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 pt-6 pb-36">
        <div className="max-w-2xl w-full">
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
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
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
              iconRight={<ArrowRight />}
            >
              {step.primaryLabel ?? 'Continuar'}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
