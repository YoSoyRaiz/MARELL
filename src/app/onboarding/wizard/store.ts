'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { initialAnswers, type OnboardingAnswers } from './types'

interface OnboardingState {
  currentStep: number
  answers: OnboardingAnswers
  /** Owner of the persisted state. When the active session belongs to
   *  a different user, the client wipes the store before showing the
   *  wizard — prevents cross-user contamination on shared devices. */
  ownerId: string | null
  hasHydrated: boolean
  /** Cuando Step20 quiere editar una cuenta ya capturada, escribe el id
   *  aquí antes de hacer back(). Step19 lo detecta y prefilea el form;
   *  al submit, actualiza el AccountInput existente en vez de agregar
   *  uno nuevo. Se limpia al volver a Step20. */
  editingAccountId: string | null
  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void
  setStep: (n: number) => void
  setOwner: (userId: string) => void
  setEditingAccount: (id: string | null) => void
  next: () => void
  back: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 0,
      answers: initialAnswers,
      ownerId: null,
      hasHydrated: false,
      editingAccountId: null,
      setAnswer: (key, value) =>
        set((s) => ({ answers: { ...s.answers, [key]: value } })),
      setStep: (n) => set({ currentStep: Math.max(0, n) }),
      setOwner: (userId) => set({ ownerId: userId }),
      setEditingAccount: (id) => set({ editingAccountId: id }),
      next: () => set((s) => ({ currentStep: s.currentStep + 1 })),
      back: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      reset: () =>
        set({
          currentStep: 0,
          answers: initialAnswers,
          ownerId: null,
          editingAccountId: null,
        }),
    }),
    {
      name: 'marell:onboarding:v1',
      // Bumping the version invalidates older persisted blobs, including
      // the case where a previous user finished onboarding (currentStep
      // pointing at the last step) and a new user logs into the same
      // browser — that stale state used to drop them straight into the
      // final screen. v3 is the first version that actively resets.
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentStep: s.currentStep,
        answers: s.answers,
        ownerId: s.ownerId,
      }),
      // Deep-merge persisted answers on top of the current default answers.
      // This guarantees newly added fields (like targets/accounts) get their
      // initial value even when an older persisted blob doesn't include them.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<OnboardingState>
        return {
          ...current,
          ...p,
          answers: {
            ...current.answers,
            ...(p.answers ?? {}),
          },
        }
      },
    }
  )
)
