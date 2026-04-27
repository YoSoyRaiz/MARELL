'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { initialAnswers, type OnboardingAnswers } from './types'

interface OnboardingState {
  currentStep: number
  answers: OnboardingAnswers
  hasHydrated: boolean
  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void
  setStep: (n: number) => void
  next: () => void
  back: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 0,
      answers: initialAnswers,
      hasHydrated: false,
      setAnswer: (key, value) =>
        set((s) => ({ answers: { ...s.answers, [key]: value } })),
      setStep: (n) => set({ currentStep: Math.max(0, n) }),
      next: () => set((s) => ({ currentStep: s.currentStep + 1 })),
      back: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      reset: () => set({ currentStep: 0, answers: initialAnswers }),
    }),
    {
      name: 'marell:onboarding:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ currentStep: s.currentStep, answers: s.answers }),
      onRehydrateStorage: () => (state) => {
        state?.setStep && (state.hasHydrated = true)
      },
    }
  )
)
