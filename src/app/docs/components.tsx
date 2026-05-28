import type { ReactNode } from 'react'
import { Info, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react'

// Reusable building blocks for docs pages. Keep the API tiny so writing
// content stays close to plain JSX.

type CalloutTone = 'info' | 'warning' | 'tip' | 'success'

const CALLOUT_STYLES: Record<
  CalloutTone,
  { bg: string; border: string; text: string; Icon: typeof Info }
> = {
  info: {
    bg: 'bg-[rgba(77,168,255,0.06)]',
    border: 'border-[var(--info)]/30',
    text: 'text-[var(--info)]',
    Icon: Info,
  },
  warning: {
    bg: 'bg-[rgba(245,200,66,0.06)]',
    border: 'border-[var(--warn)]/30',
    text: 'text-[var(--warn)]',
    Icon: AlertTriangle,
  },
  tip: {
    bg: 'bg-[rgba(61,220,151,0.06)]',
    border: 'border-[var(--brand-2)]/30',
    text: 'text-[var(--brand-text)]',
    Icon: Sparkles,
  },
  success: {
    bg: 'bg-[rgba(61,220,151,0.06)]',
    border: 'border-[var(--brand-2)]/30',
    text: 'text-[var(--brand-text)]',
    Icon: CheckCircle2,
  },
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone
  title?: string
  children: ReactNode
}) {
  const s = CALLOUT_STYLES[tone]
  return (
    <div
      className={`my-6 rounded-2xl border ${s.border} ${s.bg} px-4 py-3 flex gap-3`}
      role="note"
    >
      <s.Icon size={18} strokeWidth={2.2} className={`${s.text} shrink-0 mt-0.5`} />
      <div className="text-body text-[var(--text)] leading-relaxed flex-1">
        {title && (
          <div className={`${s.text} font-semibold mb-1 text-body-sm`}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Inline keyboard key badge — `<Kbd>N</Kbd>`. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-[var(--border2)] bg-white/[0.04] text-eyebrow font-semibold tabular-nums text-[var(--text)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  )
}

/** Numbered step list. Renders the index automatically. */
export function StepList({ children }: { children: ReactNode }) {
  return <ol className="my-6 space-y-4 list-none counter-reset-step">{children}</ol>
}

export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="relative pl-12 doc-step">
      <span className="doc-step-bullet absolute left-0 top-0 w-9 h-9 rounded-xl gradient-bg text-[#0B0B0C] font-bold text-emph flex items-center justify-center shadow-[0_4px_16px_rgba(61,220,151,0.18)]" />
      <h3 className="text-[16px] font-semibold text-[var(--text)] leading-snug mt-1">
        {title}
      </h3>
      {children && (
        <div className="mt-2 text-body text-[var(--text2)] leading-relaxed">
          {children}
        </div>
      )}
    </li>
  )
}

export function FeatureGrid({ children }: { children: ReactNode }) {
  return (
    <div className="my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  )
}

export function FeatureCard({
  Icon,
  title,
  children,
}: {
  Icon: typeof Info
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-5 space-y-2">
      <div className="w-10 h-10 rounded-xl bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] flex items-center justify-center">
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="text-emph font-semibold text-[var(--text)] leading-snug">
        {title}
      </div>
      <div className="text-body-sm text-[var(--text2)] leading-relaxed">
        {children}
      </div>
    </div>
  )
}

/** Image placeholder for screenshots that haven't been captured yet —
 *  better than a broken <img>. Replace with <Image> as screenshots
 *  land in /public/docs/. */
export function ScreenshotPlaceholder({
  label,
  ratio = '16/10',
}: {
  label: string
  ratio?: string
}) {
  return (
    <div
      className="my-6 rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--s1)]/40 flex items-center justify-center text-meta text-[var(--muted)]"
      style={{ aspectRatio: ratio }}
    >
      {label}
    </div>
  )
}
