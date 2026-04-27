'use client'

import { useOnboardingStore } from '../store'
import type { Motivation } from '../types'

const OPTIONS: { id: Motivation; emoji: string; title: string; description: string }[] = [
  {
    id: 'simplify',
    emoji: '🧘',
    title: 'Simplificar mis finanzas',
    description: 'Tener todo en un solo lugar y sin estrés.',
  },
  {
    id: 'pay_off_debt',
    emoji: '💳',
    title: 'Salir de deudas',
    description: 'Liberarme de tarjetas y préstamos.',
  },
  {
    id: 'save_for_goal',
    emoji: '🎯',
    title: 'Ahorrar para una meta',
    description: 'Vacaciones, casa, carro o lo que sea.',
  },
  {
    id: 'stop_paycheck_to_paycheck',
    emoji: '🌊',
    title: 'Dejar de vivir mes a mes',
    description: 'Llegar a fin de mes con calma.',
  },
  {
    id: 'build_habits',
    emoji: '🌱',
    title: 'Construir buenos hábitos',
    description: 'Aprender a manejar mi dinero.',
  },
  {
    id: 'take_control',
    emoji: '🎛️',
    title: 'Tomar el control',
    description: 'Saber a dónde se va cada peso.',
  },
]

export function Step02Motivation() {
  const selected = useOnboardingStore((s) => s.answers.motivation)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const name = useOnboardingStore((s) => s.answers.name)

  const firstName = name.trim().split(' ')[0]
  const greeting = firstName
    ? `${firstName}, ¿qué te trae a `
    : '¿Qué te trae a '

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          {greeting}
          <span className="gradient-text">MARELL</span>?
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-md">
          Vamos a personalizar tu plan según lo que más te importa.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const active = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAnswer('motivation', opt.id)}
              className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
                active
                  ? 'border-[var(--brand-2)] bg-white/[0.04] shadow-[0_0_0_4px_rgba(61,220,151,0.10)]'
                  : 'border-[var(--border)] bg-[var(--s1)] hover:border-[var(--border3)] hover:-translate-y-[1px]'
              }`}
            >
              <div className="text-2xl mb-2.5">{opt.emoji}</div>
              <div className="font-semibold text-[15px] text-[var(--text)] mb-1">
                {opt.title}
              </div>
              <div className="text-[13px] text-[var(--text2)] leading-snug">
                {opt.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
