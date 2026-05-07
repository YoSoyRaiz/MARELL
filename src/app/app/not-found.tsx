import Link from 'next/link'
import { Compass, ArrowRight } from 'lucide-react'

export default function AppNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--overlay-1)] text-[var(--text2)] flex items-center justify-center mx-auto">
          <Compass size={26} strokeWidth={2} />
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-[var(--text)]">
          No encontramos esta página
        </h1>
        <p className="text-[13px] text-[var(--text2)] leading-relaxed">
          El link puede estar viejo o el recurso ya no existe.
        </p>
        <Link
          href="/app"
          className="h-10 px-4 text-[13px] font-semibold rounded-xl gradient-bg text-[#0B0B0C] hover:brightness-105 transition-[filter] inline-flex items-center gap-2 mx-auto w-fit"
        >
          Ir al resumen
          <ArrowRight size={13} strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  )
}
