import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ArrowRight } from 'lucide-react'
import { DocsSidebar } from './DocsSidebar'
import { DocsToc } from './DocsToc'
import { DocsMobileNav } from './DocsMobileNav'

export const metadata: Metadata = {
  title: 'Documentación · MARELL',
  description:
    'Guía completa de MARELL: cómo planear tu mes, asignar dinero, registrar movimientos, leer recibos automáticamente, y alcanzar tus metas.',
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" aria-label="MARELL" className="shrink-0">
              <Logo variant="horizontal" height={26} />
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/[0.04] border border-[var(--border)] text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--text2)]">
              Docs
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <DocsMobileNav />
            <Link
              href="/app"
              className="h-9 px-4 gradient-bg text-[#0B0B0C] font-semibold text-[12px] sm:text-[13px] rounded-xl glow-on-hover hover:brightness-105 inline-flex items-center gap-1.5 transition-[filter]"
            >
              Abrir app
              <ArrowRight size={12} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_220px] gap-8 lg:gap-10 py-8 lg:py-12">
        {/* Left sidebar — desktop only. Mobile uses the drawer in
            DocsMobileNav. */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <DocsSidebar />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">{children}</main>

        {/* Right rail TOC — xl+ only */}
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <DocsToc />
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-12 py-8">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <Logo variant="icon" height={20} />
            <span>© {new Date().getFullYear()} MARELL · Hecho en RD</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="hover:text-[var(--text)] transition-colors">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-[var(--text)] transition-colors">
              Términos
            </Link>
            <Link href="/" className="hover:text-[var(--text)] transition-colors">
              Inicio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
