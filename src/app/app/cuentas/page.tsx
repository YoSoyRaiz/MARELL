export default function CuentasPage() {
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Cuentas
      </div>
      <h1 className="text-[32px] sm:text-[40px] leading-[1.05] font-bold tracking-tight">
        Tus <span className="gradient-text">cuentas</span>.
      </h1>
      <p className="text-[var(--text2)] text-[16px] leading-relaxed max-w-xl">
        Próximamente: balances en vivo, conexiones bancarias y tracking de inversiones.
      </p>
    </div>
  )
}
