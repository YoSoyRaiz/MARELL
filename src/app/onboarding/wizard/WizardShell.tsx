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
      <div className="h-[3px] w-full bg-[var(--overlay-2)] sticky top-0 z-20">
        <div
          className="h-full gradient-bg transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header — logo centered, X close on right */}
      <header className="relative px-6 py-5">
        <div className="flex justify-center">
          <Logo height={42} />
        </div>

        <Link
          href="/"
          aria-label="Cerrar y volver al inicio"
          className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-[var(--brand-2)] hover:text-[var(--text2)] hover:bg-[var(--overlay-2)] transition-colors"
        >
          <X size={22} strokeWidth={2.2} />
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 pt-6 pb-36">
        <div className={`${step.wide ? 'max-w-5xl' : 'max-w-2xl'} w-full`}>
          <div className="text-eyebrow font-semibold uppercase tracking-[0.2em] text-[var(--muted)] mb-5">
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

      {/* Footer — counter left, back + continue right */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 pt-16 pb-6 px-6 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/90 to-transparent pointer-events-none">
        <div className={`${step.wide ? 'max-w-5xl' : 'max-w-2xl'} mx-auto flex items-center justify-between gap-4 pointer-events-auto`}>
          {/* Left side: counter + back */}
          <div className="flex items-center gap-5">
            <span className="text-meta text-[var(--muted)] tabular-nums">
              <span className="text-[var(--text2)] font-medium">{safeIndex + 1}</span>
              <span className="text-[var(--muted2)]"> / {total}</span>
            </span>
            {safeIndex > 0 && (
              <button
                type="button"
                onClick={back}
                className="h-[52px] px-7 inline-flex items-center justify-center gap-2 rounded-2xl text-emph font-semibold text-[var(--text)] bg-[var(--overlay-3)] hover:bg-[var(--overlay-4)] transition-[background-color,color] duration-200 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <ArrowLeft size={16} strokeWidth={2.2} />
                <span>Atrás</span>
              </button>
            )}
          </div>

          {/* Right side: skip + continue */}
          <div className="flex items-center gap-3">
            {step.showSkip && safeIndex < total - 1 && (
              <button
                type="button"
                onClick={next}
                className="text-body-sm text-[var(--muted)] hover:text-[var(--text)] px-3 py-2 rounded-lg transition-colors"
              >
                Saltar
              </button>
            )}
            {!step.hideContinue && (
              <Button
                variant="gradient"
                size="lg"
                onClick={next}
                disabled={!canContinue}
                iconRight={<ArrowRight size={16} strokeWidth={2.2} />}
              >
                {step.primaryLabel ?? 'Continuar'}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
