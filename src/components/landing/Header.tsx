import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const navItems = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'El problema', href: '#problema' },
  { label: 'Control total', href: '#producto' },
  { label: 'Descargar app', href: '#descargar' },
]

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="MARELL">
          <Logo variant="horizontal" height={40} priority />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[var(--text2)] transition-colors hover:text-[var(--text)] sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Button href="/signup" variant="gradient" size="sm">
            Empieza gratis
          </Button>
        </div>
      </div>
    </header>
  )
}
