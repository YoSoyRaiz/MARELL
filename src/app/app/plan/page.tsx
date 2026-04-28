export default function PlanPage() {
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Plan
      </div>
      <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
        Cada peso a un <span className="gradient-text">trabajo</span>.
      </h1>
      <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
        Próximamente: la mesa zero-based con todas tus categorías, montos asignados y disponibles
        en tiempo real.
      </p>
    </div>
  )
}
