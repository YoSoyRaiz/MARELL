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
