import Link from 'next/link'
import { Globe } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

function IgIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}
function FbIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
    </svg>
  )
}
function LiIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

const columns = [
  {
    heading: 'Producto',
    links: [
      { label: 'Resumen',       href: '#producto' },
      { label: 'Cuentas',       href: '#producto' },
      { label: 'Análisis',      href: '#producto' },
      { label: 'Transacciones', href: '#producto' },
      { label: 'Metas',         href: '#producto' },
    ],
  },
  {
    heading: 'Recursos',
    links: [
      { label: 'Blog',                  href: '#recursos' },
      { label: 'Guías',                 href: '#recursos' },
      { label: 'Preguntas frecuentes',  href: '#recursos' },
      { label: 'Centro de ayuda',       href: '#recursos' },
    ],
  },
  {
    heading: 'Empresa',
    links: [
      { label: 'Sobre nosotros',     href: '#sobre' },
      { label: 'Trabaja con nosotros', href: '#sobre' },
      { label: 'Contacto',           href: '#sobre' },
      { label: 'Prensa',             href: '#sobre' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Términos',    href: '#legal' },
      { label: 'Privacidad',  href: '#legal' },
      { label: 'Seguridad',   href: '#legal' },
    ],
  },
]

const socials = [
  { Icon: IgIcon, label: 'Instagram', href: '#' },
  { Icon: XIcon,  label: 'Twitter',   href: '#' },
  { Icon: FbIcon, label: 'Facebook',  href: '#' },
  { Icon: LiIcon, label: 'LinkedIn',  href: '#' },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.05] py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Logo variant="horizontal" height={28} />
            <p className="mt-4 text-sm text-[var(--text2)]">
              Tu dinero. Tu futuro. Bajo control.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {socials.map(({ Icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-white/[0.08] text-[var(--text2)] transition-colors hover:border-white/20 hover:text-[var(--text)]"
                >
                  <Icon size={15} />
                </Link>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-3">
            {columns.map((col) => (
              <div key={col.heading}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  {col.heading}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--text2)] transition-colors hover:text-[var(--text)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Language */}
          <div className="lg:col-span-1 lg:justify-self-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-sm font-medium text-[var(--text2)] transition-colors hover:border-white/20 hover:text-[var(--text)]"
            >
              <Globe size={14} strokeWidth={2} />
              Español
            </button>
          </div>
        </div>

        <div className="mt-14 border-t border-white/[0.05] pt-6 text-xs text-[var(--muted)]">
          © 2026 Marell. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}
