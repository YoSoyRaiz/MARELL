/**
 * Helper para chequear si un email está en el allowlist de auditores.
 *
 * Allowlist controla quién puede ver el feature de gestión de clientes
 * antes de tener clientes activos. Una vez que el auditor crea ≥1
 * cliente, ya queda registrado en `agency_relationships` y el feature
 * se descubre por estado de la DB, no por env var.
 *
 * Lógica: env var `MARELL_AUDITOR_ALLOWLIST` como CSV de emails. Vacía
 * o ausente = allowlist desactivado (development / testing). En
 * producción siempre se define.
 *
 * Llamadas previas a este helper estaban duplicadas en:
 *   - src/app/app/clientes/page.tsx
 *   - src/app/app/clientes/nuevo/page.tsx
 * Ahora consolidadas aquí.
 */
export function isInAuditorAllowlist(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.MARELL_AUDITOR_ALLOWLIST ?? ''
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // Allowlist vacío = sin restricción (caso development). En prod
  // siempre se define, así que esta rama "true" cubre solo el dev.
  if (list.length === 0) return true
  return list.includes(email.toLowerCase())
}
