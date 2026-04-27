import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-xl font-extrabold tracking-tight gradient-text">MARELL</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center py-20">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            <span className="gradient-text">Claridad</span> en cada peso.
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-xl mx-auto" style={{ color: 'var(--text2)' }}>
            Toma el control de tu dinero. Paga deudas, ahorra para tus metas y deja de
            preguntarte a dónde se fue tu sueldo. Pensado para República Dominicana.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/signup"
              className="px-6 py-3.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--gradient)', color: '#0B0B0C' }}
            >
              Empezar gratis — 30 días
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-xl font-medium text-sm border"
              style={{ borderColor: 'var(--border3)', color: 'var(--text)' }}
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="text-xs mt-6" style={{ color: 'var(--muted)' }}>
            Sin tarjeta. $9.99/mes después del trial.
          </p>
        </div>
      </section>
    </main>
  )
}
