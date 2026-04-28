'use client'

import { useMemo } from 'react'
import { Wand2, Scale } from 'lucide-react'
import { useOnboardingStore } from '../store'
import { generateCategories } from '../categoryGenerator'
import { MoneyInput } from '../components/MoneyInput'

const keyOf = (groupName: string, itemName: string) => `${groupName}::${itemName}`

const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function Step23ZeroBased() {
  const answers = useOnboardingStore((s) => s.answers)
  const setAnswer = useOnboardingStore((s) => s.setAnswer)

  const groups = useMemo(() => generateCategories(answers), [answers])

  const assignableCash = answers.accounts
    .filter((a) => {
      if (a.type === 'checking' || a.type === 'cash') return true
      if (a.type === 'savings' && !answers.savingsAside[a.id]) return true
      return false
    })
    .reduce((s, a) => s + a.balance, 0)

  const totalAssigned = Object.values(answers.assignments).reduce((s, v) => s + (v || 0), 0)
  const remaining = assignableCash - totalAssigned

  const isPerfectZero = Math.abs(remaining) < 0.005
  const isOverAssigned = remaining < -0.005

  const setAssignment = (key: string, val: number | null) => {
    const next = { ...answers.assignments }
    if (val === null || val === 0) delete next[key]
    else next[key] = val
    setAnswer('assignments', next)
  }

  const applyTargets = () => {
    setAnswer('assignments', { ...answers.targets })
  }

  const clearAll = () => {
    setAnswer('assignments', {})
  }

  const hasTargets = Object.keys(answers.targets).length > 0

  // Find the best buffer category for Auto-balancear:
  // 1. "Fondo de emergencia" if it exists
  // 2. First item in Metas group
  // 3. First item in Gustos / Necesidades / Facturas (in that order)
  const buffer = useMemo(() => {
    const all = groups.flatMap((g) =>
      g.items.map((it) => ({ groupName: g.name, itemName: it.name })),
    )
    const fondo = all.find((x) => x.itemName === 'Fondo de emergencia')
    if (fondo) {
      return { ...fondo, key: keyOf(fondo.groupName, fondo.itemName) }
    }
    const order = ['Metas', 'Gustos', 'Necesidades', 'Facturas']
    for (const groupName of order) {
      const g = groups.find((gg) => gg.name === groupName)
      if (g && g.items.length > 0) {
        return {
          groupName: g.name,
          itemName: g.items[0].name,
          key: keyOf(g.name, g.items[0].name),
        }
      }
    }
    return null
  }, [groups])

  const autoBalance = () => {
    if (remaining <= 0.005 || !buffer) return
    const current = answers.assignments[buffer.key] ?? 0
    setAnswer('assignments', {
      ...answers.assignments,
      [buffer.key]: Math.round((current + remaining) * 100) / 100,
    })
  }

  const showAutoBalance = remaining > 0.005 && buffer !== null

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
          Cada peso a un <span className="gradient-text">trabajo</span>.
        </h1>
        <p className="text-[var(--text2)] text-[17px] leading-relaxed max-w-xl">
          Asigna tu dinero a las categorías hasta que <span className="text-[var(--text)] font-medium">por asignar</span>{' '}
          llegue a cero. Esto es lo que separa tener dinero de tener un plan.
        </p>
      </div>

      {/* Hero: Por asignar */}
      <div
        className={`rounded-2xl border-2 px-6 py-5 transition-colors ${
          isPerfectZero
            ? 'border-[var(--brand-2)] bg-[rgba(61,220,151,0.06)]'
            : isOverAssigned
              ? 'border-[var(--coral)] bg-[rgba(255,122,89,0.06)]'
              : 'border-[var(--border2)] bg-[var(--s1)]'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div
              className={`text-[12px] uppercase tracking-[0.18em] font-semibold ${
                isPerfectZero
                  ? 'text-[var(--brand-2)]'
                  : isOverAssigned
                    ? 'text-[var(--coral)]'
                    : 'text-[var(--brand-2)]'
              }`}
            >
              {isPerfectZero ? '¡Plan listo!' : isOverAssigned ? 'Te pasaste' : 'Por asignar'}
            </div>
            <div className="text-[13px] text-[var(--text2)] mt-1">
              {isPerfectZero
                ? 'Cada peso tiene un trabajo. Buen trabajo.'
                : isOverAssigned
                  ? `Asignaste ${fmtMoney(-remaining)} de más. Reduce algunas categorías.`
                  : `Tienes ${fmtMoney(assignableCash)} disponibles. Asigna ${fmtMoney(remaining)} más.`}
            </div>
          </div>
          <div
            className={`text-[28px] sm:text-[34px] font-bold tabular-nums num shrink-0 ${
              isPerfectZero
                ? 'gradient-text'
                : isOverAssigned
                  ? 'text-[var(--coral)]'
                  : 'text-[var(--text)]'
            }`}
          >
            {isOverAssigned ? '−' : ''}
            {fmtMoney(remaining)}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasTargets && (
          <button
            type="button"
            onClick={applyTargets}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-[var(--brand-2)] bg-[rgba(61,220,151,0.10)] hover:bg-[rgba(61,220,151,0.16)] transition-colors"
          >
            <Wand2 size={14} strokeWidth={2.2} />
            Usar mis metas
          </button>
        )}
        {showAutoBalance && buffer && (
          <button
            type="button"
            onClick={autoBalance}
            title={`Mueve ${fmtMoney(remaining)} a ${buffer.itemName}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-[#0B0B0C] gradient-bg hover:brightness-105 active:brightness-95 transition-[filter]"
          >
            <Scale size={14} strokeWidth={2.4} />
            Auto-balancear ·{' '}
            <span className="num">{fmtMoney(remaining)}</span>
            <span className="text-[#0B0B0C]/60 font-normal">→</span>
            <span>{buffer.itemName}</span>
          </button>
        )}
        <button
          type="button"
          onClick={clearAll}
          className="text-[13px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline px-2 py-2 transition-colors"
        >
          Limpiar todo
        </button>
      </div>

      {/* Categorías */}
      <div className="space-y-4">
        {groups.map((g) => {
          const groupTotal = g.items.reduce((s, item) => {
            const k = keyOf(g.name, item.name)
            return s + (answers.assignments[k] ?? 0)
          }, 0)
          return (
            <div
              key={g.name}
              className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-[var(--border)] bg-white/[0.02] flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
                  {g.name}
                </h3>
                <span className="text-[12px] text-[var(--text2)] tabular-nums num">
                  {fmtMoney(groupTotal)}
                </span>
              </div>
              <ul>
                {g.items.map((item, i) => {
                  const k = keyOf(g.name, item.name)
                  const value = answers.assignments[k] ?? null
                  const target = answers.targets[k]
                  return (
                    <li
                      key={`${g.name}-${i}`}
                      className="px-5 py-3 grid grid-cols-[1fr_140px] items-center gap-3 border-b border-[var(--border)] last:border-b-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[var(--text2)] flex items-center shrink-0">
                          <item.Icon size={16} strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[14px] text-[var(--text)] truncate">{item.name}</div>
                          {target !== undefined && target > 0 && (
                            <div className="text-[11px] text-[var(--muted)] num">
                              meta: ${target.toLocaleString('en-US')}
                            </div>
                          )}
                        </div>
                      </div>
                      <MoneyInput
                        value={value}
                        onChange={(v) => setAssignment(k, v)}
                        ariaLabel={`Asignar a ${item.name}`}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
