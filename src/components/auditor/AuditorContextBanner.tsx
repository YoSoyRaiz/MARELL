import { Eye, Undo2 } from 'lucide-react'
import { setActiveBudgetToOwn } from '@/lib/budget/actions'

interface Props {
  /** Texto que se muestra: nombre del cliente o del budget compartido.
   *  null = no renderizar (estamos en nuestro propio budget). */
  contextLabel: string | null
  /** Tipo de contexto. 'auditor' usa copy de "Auditando: X". 'shared'
   *  usa "Viendo presupuesto compartido: X" (familia donde te
   *  invitaron como editor/viewer). */
  contextType: 'auditor' | 'shared'
}

/**
 * Strip horizontal de 36px sobre el TopBar que avisa al usuario
 * cuando está viendo un budget que NO es suyo. Es global — aparece
 * en toda ruta /app/* mientras el active budget tenga created_by !=
 * user.id.
 *
 * Color amber: visible pero no alarmante (rojo = error, verde =
 * brand). El objetivo es que el ojo lo detecte sin distraer del
 * contenido principal.
 *
 * El botón "Volver" usa un form server-side con server action en vez
 * de un botón cliente para que funcione sin JS (PWA offline-friendly)
 * y respete el flow de revalidate + redirect en una sola call.
 */
export function AuditorContextBanner({ contextLabel, contextType }: Props) {
  if (!contextLabel) return null

  const heading =
    contextType === 'auditor'
      ? 'Auditando'
      : 'Viendo presupuesto compartido'

  return (
    <div className="sticky top-0 z-40 bg-[rgba(245,200,66,0.10)] dark:bg-[rgba(245,200,66,0.08)] border-b border-[var(--warn)]/30 px-4 sm:px-6 md:px-8 py-2 flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 min-w-0 flex-1">
        <Eye
          size={13}
          strokeWidth={2.2}
          className="text-[var(--warn-text)] shrink-0"
        />
        <div className="text-meta text-[var(--text)] truncate">
          <span className="text-[var(--warn-text)] font-semibold uppercase tracking-[0.12em] text-tiny mr-2">
            {heading}
          </span>
          <span className="font-medium">{contextLabel}</span>
        </div>
      </div>
      <form action={setActiveBudgetToOwn}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-meta font-semibold text-[var(--warn-text)] hover:text-[var(--text)] hover:bg-[var(--overlay-2)] px-2 py-1 rounded-md transition-colors whitespace-nowrap"
        >
          <Undo2 size={12} strokeWidth={2.4} />
          Volver a mi cuenta
        </button>
      </form>
    </div>
  )
}
