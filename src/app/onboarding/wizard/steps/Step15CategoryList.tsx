'use client'

import { Sparkles } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { generateCategories } from '../categoryGenerator'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function Step15CategoryList() {
  const confirm = useConfirm()
  const answers = useOnboardingStore((s) => s.answers)
  const reset = useOnboardingStore((s) => s.reset)
  const groups = generateCategories(answers)
  const total = groups.reduce((sum, g) => sum + g.items.length, 0)

  const handleStartOver = async () => {
    const ok = await confirm({
      title: '¿Empezar de nuevo?',
      description: 'Se borrarán todas tus respuestas y volverás al inicio del onboarding.',
      confirmLabel: 'Empezar de nuevo',
      tone: 'danger',
    })
    if (ok) reset()
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[1.05] font-bold tracking-tight">
          Tu lista de <span className="gradient-text">categorías</span>
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          Generamos <span className="text-[var(--text)] font-semibold">{total} categorías</span>{' '}
          personalizadas a tu vida. Vas a poder ajustarlas cuando configures tu plan.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Lista de categorías */}
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={g.name}
              className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--overlay-1)] flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                  {g.name}
                </h3>
                <span className="text-[12px] text-[var(--muted)] tabular-nums">
                  {g.items.length}
                </span>
              </div>
              <ul>
                {g.items.map((item, i) => (
                  <li
                    key={`${g.name}-${i}`}
                    className="px-5 py-3 flex items-center gap-3 text-[14px] border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--overlay-2)] transition-colors"
                  >
                    <span className="text-[var(--text2)] flex items-center">
                      <item.Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="text-[var(--text)]">{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Card celebratoria */}
        <div className="lg:sticky lg:top-6">
          <div className="gradient-border rounded-2xl p-6 space-y-5">
            <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center text-[#0B0B0C]">
              <Sparkles size={26} strokeWidth={2.2} />
            </div>
            <div className="space-y-2">
              <h3 className="text-[22px] font-bold leading-tight">
                Tu plan está en <span className="gradient-text">marcha</span>
              </h3>
              <p className="text-[14px] text-[var(--text2)] leading-relaxed">
                Genial trabajo. En el siguiente paso afinaremos los montos y conectaremos tus
                cuentas para que cada peso tenga su lugar.
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleStartOver}
                className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline transition-colors"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
