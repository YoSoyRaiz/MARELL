'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, X, ArrowRight, Sparkles, ChevronDown } from 'lucide-react'

interface FirstMonthGuideProps {
  hasAssigned: boolean
  hasTransaction: boolean
  hasGoal: boolean
  hasReconciled: boolean
}

const DISMISS_KEY = 'marell:first-month-guide-dismissed'

/**
 * Welcome / "primer mes" guide for new users. Shown above the resumen
 * dashboard to walk users through the four habits that make zero-based
 * budgeting click:
 *
 *   1. Asignar dinero — give every peso a job
 *   2. Registrar transacciones — track what actually happened
 *   3. Crear una meta — establish what you're working towards
 *   4. Reconciliar — close the loop with the bank
 *
 * Each step auto-checks itself when the corresponding behavior is
 * detected server-side (e.g. there's at least one assignment row).
 * The user can dismiss permanently via the X — we don't nag.
 */
export function FirstMonthGuide({
  hasAssigned,
  hasTransaction,
  hasGoal,
  hasReconciled,
}: FirstMonthGuideProps) {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  // Cuando el usuario ha completado ≥1 paso (y aún no todo), el banner
  // entra en estado colapsado por default. La guía deja de dominar el
  // above-fold y se vuelve un recordatorio sutil. Click para expandir.
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  // Don't render until we've checked localStorage to avoid flash.
  if (dismissed !== false) return null

  const steps = [
    {
      id: 'assign',
      label: 'Asigna tu primer peso',
      description: 'Dale un trabajo a cada peso. Empieza con Facturas.',
      done: hasAssigned,
      href: '/app/plan',
      cta: 'Ir al plan',
    },
    {
      id: 'transaction',
      label: 'Registra tu primera transacción',
      description: 'Agrega un gasto real para ver cómo tu plan reacciona.',
      done: hasTransaction,
      href: '/app/transacciones',
      cta: 'Agregar transacción',
    },
    {
      id: 'goal',
      label: 'Crea una meta',
      description: 'Hacia dónde va tu esfuerzo: emergencias, viaje, prima.',
      done: hasGoal,
      href: '/app/metas',
      cta: 'Crear meta',
    },
    {
      id: 'reconcile',
      label: 'Reconcilia una cuenta',
      description: 'Cuadra tu balance contra el banco para cerrar el mes.',
      done: hasReconciled,
      href: '/app/cuentas',
      cta: 'Ir a cuentas',
    },
  ]

  const completed = steps.filter((s) => s.done).length
  const total = steps.length
  const allDone = completed === total

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  // Estado por default:
  //   - 0 pasos: expandido (usuario nuevo necesita ver el camino completo)
  //   - 1-3 pasos: colapsado (sabe qué hacer, no robar above-fold)
  //   - 4 pasos: expandido (one-last-time celebration)
  const shouldBeExpandedByDefault = completed === 0 || allDone
  const isExpanded = expanded || shouldBeExpandedByDefault

  // Colapsado: barra delgada con progreso + CTA al siguiente paso pendiente.
  if (!isExpanded) {
    const nextStep = steps.find((s) => !s.done)
    return (
      <section className="rounded-2xl gradient-border px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg gradient-bg text-[#0B0B0C] flex items-center justify-center shrink-0">
          <Sparkles size={13} strokeWidth={2.4} />
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex-1 min-w-0 text-left"
          aria-expanded={false}
          aria-controls="first-month-guide"
        >
          <div className="text-meta text-[var(--text)] font-semibold">
            Tu primer mes ·{' '}
            <span className="text-[var(--brand-text)] num tabular-nums">
              {completed}/{total}
            </span>
          </div>
          {nextStep && (
            <div className="text-eyebrow text-[var(--muted)] truncate mt-0.5">
              Siguiente: {nextStep.label}
            </div>
          )}
        </button>
        {nextStep && (
          <Link
            href={nextStep.href}
            className="shrink-0 inline-flex items-center gap-1 text-meta font-semibold text-[var(--brand-text)] hover:underline underline-offset-4"
          >
            {nextStep.cta}
            <ArrowRight size={11} strokeWidth={2.4} />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expandir guía"
          className="shrink-0 w-7 h-7 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
        >
          <ChevronDown size={14} strokeWidth={2.4} />
        </button>
      </section>
    )
  }

  return (
    <section
      id="first-month-guide"
      className="rounded-2xl gradient-border p-5 sm:p-6 space-y-4 relative"
    >
      <div className="absolute top-4 right-4 flex items-center gap-1">
        {completed > 0 && !allDone && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Colapsar guía"
            aria-expanded={true}
            aria-controls="first-month-guide"
            className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors rotate-180"
          >
            <ChevronDown size={14} strokeWidth={2.4} />
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar guía"
          className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg text-[#0B0B0C] flex items-center justify-center shrink-0">
          <Sparkles size={18} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
            Tu primer mes
          </div>
          <h2 className="text-h3 font-bold leading-tight tracking-tight mt-1">
            {allDone ? (
              <>
                Dominaste el <span className="gradient-text">flujo</span>.
              </>
            ) : (
              <>
                4 pasos para ponerle <span className="gradient-text">trabajo a cada peso</span>
              </>
            )}
          </h2>
          <div className="text-meta text-[var(--muted)] mt-1 num tabular-nums">
            {completed} de {total} completados
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${
              step.done
                ? 'border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)]'
                : 'border-[var(--border)] bg-[var(--bg)]'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                step.done
                  ? 'gradient-bg text-[#0B0B0C]'
                  : 'border border-[var(--border2)] text-[var(--muted)]'
              }`}
            >
              {step.done ? (
                <Check size={14} strokeWidth={2.8} />
              ) : (
                <Circle size={11} strokeWidth={2.2} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-body-sm font-semibold ${
                  step.done ? 'text-[var(--brand-text)] line-through' : 'text-[var(--text)]'
                }`}
              >
                {step.label}
              </div>
              <div className="text-eyebrow text-[var(--muted)] leading-relaxed mt-0.5">
                {step.description}
              </div>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 inline-flex items-center gap-1 text-meta font-semibold text-[var(--brand-text)] hover:underline underline-offset-4"
              >
                {step.cta}
                <ArrowRight size={11} strokeWidth={2.4} />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="rounded-xl bg-[rgba(61,220,151,0.06)] border border-[var(--brand-2)]/30 px-4 py-3 text-meta text-[var(--text)] leading-relaxed">
          ¡Buen trabajo! Si quieres, puedes ocultar esta guía con la X arriba a la derecha.
        </div>
      )}
    </section>
  )
}
