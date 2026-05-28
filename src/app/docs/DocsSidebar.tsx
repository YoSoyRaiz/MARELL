'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_NAV } from './nav'

interface DocsSidebarProps {
  /** When the parent renders this inside a mobile drawer, the close
   *  callback fires every time a link is tapped so the drawer goes
   *  away after navigation. On desktop it's a no-op. */
  onNavigate?: () => void
}

export function DocsSidebar({ onNavigate }: DocsSidebarProps) {
  const pathname = usePathname() ?? ''

  return (
    <nav aria-label="Documentación" className="text-body">
      {DOCS_NAV.map((section) => (
        <div key={section.title} className="mb-6">
          <div className="text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted2)] mb-2 px-3">
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.links.map((link) => {
              const active = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={`block px-3 py-1.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)] font-semibold'
                        : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04]'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
