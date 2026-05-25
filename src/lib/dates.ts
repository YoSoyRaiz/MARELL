// Timezone-aware date helpers.
//
// All MARELL date math (current month for the dashboard, "today" defaults
// in transaction forms, scheduled-transaction firing, etc.) should run in
// Dominican Republic local time, NOT UTC. Vercel servers are UTC by
// default — a naive `new Date().getMonth()` on the server flips to the
// next month at 8pm DR time and breaks the "current month" filter.

const TZ = 'America/Santo_Domingo'

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const monthFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
})

/** YYYY-MM-DD in DR local time. */
export function todayISODR(): string {
  // en-CA gives ISO-style "YYYY-MM-DD".
  return dateFmt.format(new Date())
}

/** YYYY-MM in DR local time. */
export function currentMonthDR(): string {
  return monthFmt.format(new Date())
}

/**
 * Returns the first/last YYYY-MM-DD of the given YYYY-MM. Pure string math
 * so it doesn't depend on timezone — `month` is already an absolute label.
 */
export function monthBoundsISO(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last day of this month
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { first, last }
}

// ── Nombres de mes en español ───────────────────────────────────
// Centralizados acá para que cualquier formatter de la app use los
// mismos strings (antes estaban duplicados en 7 archivos: page.tsx
// de plan/programadas/analisis/etc., MonthStatusHero, ScheduledFormModal…).

/** Nombres completos: Enero, Febrero, ... */
export const MONTH_NAMES_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

/** Abreviados 3 letras capitalizados: Ene, Feb, Mar, ... */
export const MONTH_NAMES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

/** Abreviados lowercase para slugs y fallback strings de payee: ene, feb, … */
export const MONTH_NAMES_SHORT_LOWER = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/** "Mayo 2026" — full month label desde 'YYYY-MM'. */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES_FULL[m - 1]} ${y}`
}

/**
 * Extrae 'YYYY-MM' desde una fecha ISO 'YYYY-MM-DD'. Regex estricta
 * que rechaza fechas imposibles (2026-13-01, 2026-02-31). Devuelve
 * null si el input es inválido. Usado por la lógica de CC bucket que
 * key-ea monthly_assignments por mes.
 */
export function monthFromDate(iso: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(iso)
  if (!m) return null
  return `${m[1]}-${m[2]}`
}

/** "15 May" — short date label desde 'YYYY-MM-DD'. */
export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES_SHORT[m - 1]}`
}
