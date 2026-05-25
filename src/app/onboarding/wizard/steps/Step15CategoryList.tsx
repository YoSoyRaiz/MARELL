'use client'

import { Sparkles } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { generateCategories } from '../categoryGenerator'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { WizardHeading } from '../components/WizardHeading'

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
      <WizardHeading
        descriptionMaxWidth="xl"
        description={
          <>
            Generamos <span className="text-[var(--text)] font-semibold">{total} categorías</span>{' '}
            personalizadas a tu vida. Vas a poder ajustarlas cuando configures tu plan.
          </>
        }
      >
        Tu lista de <span className="gradient-text">categorías</span>
      </WizardHeading>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Lista de categorías */}
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.name} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--overlay-1)] flex items-center justify-between">
                <h3 className="text-meta font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                  {g.name}
                </h3>
                <span className="text-meta text-[var(--muted)] tabular-nums">
                  {g.items.length}
                </span>
              </div>
              <ul>
                {g.items.map((item, i) => (
                  <li
                    key={`${g.name}-${i}`}
                    className="px-5 py-3 flex items-center gap-3 text-body border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--overlay-2)] transition-colors"
                  >
                    <span className="text-[var(--text2)] flex items-center">
                      <item.Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="text-[var(--text)]">{item.name}</span>
                  </li>
                ))}
              </ul>
            </Card>
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
              <p className="text-body text-[var(--text2)] leading-relaxed">
                Genial trabajo. En el siguiente paso afinaremos los montos y conectaremos tus
                cuentas para que cada peso tenga su lugar.
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleStartOver}
                className="text-body-sm text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline transition-colors"
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
