'use client'

import { useMemo } from 'react'
import { useOnboardingStore } from '../store'
import { generateCategories } from '../categoryGenerator'
import { MoneyInput } from '../components/MoneyInput'

const keyOf = (groupName: string, itemName: string) => `${groupName}::${itemName}`

export function Step17Targets() {
  const answers = useOnboardingStore((s) => s.answers)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)
  const next = useOnboardingStore((s) => s.next)

  const groups = useMemo(() => generateCategories(answers), [answers])

  const targetsTotal = Object.values(answers.targets).reduce((s, v) => s + (v || 0), 0)
  const filledCount = Object.values(answers.targets).filter((v) => v && v > 0).length

  const setTarget = (key: string, val: number | null) => {
    const next = { ...answers.targets }
    if (val === null || val === 0) {
      delete next[key]
    } else {
      next[key] = val
    }
    setAnswer('targets', next)
  }

  const handleSkipAll = () => {
    setAnswer('targets', {})
    next()
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          Pon una <span className="gradient-text">meta mensual</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          Es opcional — pon números solo donde tengas idea. Puedes ajustarlo todo cuando configures
          tu plan.
        </p>
      </div>

      {/* Total bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] text-[var(--brand-2)] uppercase tracking-[0.18em] font-semibold">
            Total mensual
          </div>
          <div className="text-[13px] text-[var(--text2)] mt-0.5">
            {filledCount > 0
              ? `${filledCount} ${filledCount === 1 ? 'categoría' : 'categorías'} con meta`
              : 'Aún sin metas — está bien.'}
          </div>
        </div>
        <div className="text-[24px] font-bold tabular-nums num gradient-text">
          ${targetsTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Categories grouped */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div
            key={g.name}
            className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-[var(--border)] bg-white/[0.02] flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                {g.name}
              </h3>
              <span className="text-[12px] text-[var(--muted)] tabular-nums">
                {g.items.length}
              </span>
            </div>
            <ul>
              {g.items.map((item, i) => {
                const key = keyOf(g.name, item.name)
                const value = answers.targets[key] ?? null
                return (
                  <li
                    key={`${g.name}-${i}`}
                    className="px-5 py-3 grid grid-cols-[1fr_140px] items-center gap-3 border-b border-[var(--border)] last:border-b-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[var(--text2)] flex items-center shrink-0">
                        <item.Icon size={16} strokeWidth={2} />
                      </span>
                      <span className="text-[14px] text-[var(--text)] truncate">{item.name}</span>
                    </div>
                    <MoneyInput
                      value={value}
                      onChange={(v) => setTarget(key, v)}
                      ariaLabel={`Meta para ${item.name}`}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={handleSkipAll}
          className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline transition-colors"
        >
          Continuar sin metas
        </button>
      </div>
    </div>
  )
}
