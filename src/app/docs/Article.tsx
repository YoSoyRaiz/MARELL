import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { DOCS_FLAT } from './nav'

interface ArticleProps {
  /** Used to derive prev / next links from the flat nav order. */
  pathname: string
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  children: ReactNode
}

export function Article({ pathname, eyebrow, title, lead, children }: ArticleProps) {
  const idx = DOCS_FLAT.findIndex((l) => l.href === pathname)
  const prev = idx > 0 ? DOCS_FLAT[idx - 1] : null
  const next = idx >= 0 && idx < DOCS_FLAT.length - 1 ? DOCS_FLAT[idx + 1] : null

  return (
    <article data-doc className="docs-article">
      <header className="mb-8 pb-6 border-b border-[var(--border)]">
        {eyebrow && (
          <div className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] mb-3">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[28px] sm:text-[36px] lg:text-[42px] font-bold leading-[1.05] tracking-tight">
          {title}
        </h1>
        {lead && (
          <p className="mt-4 text-[16px] sm:text-[17px] text-[var(--text2)] leading-relaxed max-w-[720px]">
            {lead}
          </p>
        )}
      </header>

      <div className="docs-prose">{children}</div>

      {(prev || next) && (
        <nav className="mt-16 pt-8 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={prev.href}
              className="rounded-2xl border border-[var(--border)] hover:border-[var(--brand-2)]/40 hover:bg-white/[0.02] p-4 transition-colors group"
            >
              <div className="text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted)] mb-1 inline-flex items-center gap-1.5">
                <ArrowLeft size={11} strokeWidth={2.4} />
                Anterior
              </div>
              <div className="text-emph font-semibold text-[var(--text)] group-hover:text-[var(--brand-text)] transition-colors">
                {prev.label}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next && (
            <Link
              href={next.href}
              className="rounded-2xl border border-[var(--border)] hover:border-[var(--brand-2)]/40 hover:bg-white/[0.02] p-4 transition-colors group text-right"
            >
              <div className="text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted)] mb-1 inline-flex items-center gap-1.5 justify-end w-full">
                Siguiente
                <ArrowRight size={11} strokeWidth={2.4} />
              </div>
              <div className="text-emph font-semibold text-[var(--text)] group-hover:text-[var(--brand-text)] transition-colors">
                {next.label}
              </div>
            </Link>
          )}
        </nav>
      )}
    </article>
  )
}
