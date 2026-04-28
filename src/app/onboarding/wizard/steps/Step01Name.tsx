'use client'

import { useOnboardingStore } from '../store'

export function Step01Name() {
  const name = useOnboardingStore((s) => s.answers.name)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <h1 className="text-[40px] sm:text-[52px] leading-[1.02] font-bold tracking-tight">
          ¿Cómo te <span className="gradient-text">llamamos</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Antes que nada, dinos tu nombre. Lo usaremos para personalizar tu plan.
        </p>
      </div>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setAnswer('name', e.target.value)}
        placeholder="Tu nombre"
        maxLength={40}
        className="w-full !text-[22px] !py-5 !px-5 !rounded-2xl"
      />
    </div>
  )
}
