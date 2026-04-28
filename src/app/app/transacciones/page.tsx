export default function TransaccionesPage() {
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Transacciones
      </div>
      <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
        Cada movimiento de tu <span className="gradient-text">dinero</span>.
      </h1>
      <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
        Próximamente: lista filtrable, edit inline, importación CSV/PDF, splits.
      </p>
    </div>
  )
}
