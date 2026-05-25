import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Daily FX-rate refresh.
 *
 * Updates `budgets.usd_to_dop_rate` for every row using the BCRD
 * (Banco Central de la República Dominicana) reference rate. We try
 * three sources in order; whichever succeeds first wins:
 *
 *   1. BCRD's "mercado cambiario" landing page scrape — the official
 *      reference exposed publicly.
 *   2. open.er-api.com — free no-key fallback that mirrors the BCRD
 *      reference rate within ~0.5 DOP. Used when BCRD's HTML changes
 *      shape and the regex stops matching.
 *
 * The route is also callable manually with the CRON_SECRET so the user
 * can refresh on-demand from a curl. Returns the rate, the source, and
 * the count of budgets updated.
 */

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  // Fail-closed en TODOS los envs — antes era accesible en preview
  // de Vercel sin secret, dejando que cualquiera escribiera tasas FX
  // arbitrarias en todos los budgets. (Auditoría 2026-05-24, A5.)
  if (!expected) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

interface RateSource {
  rate: number
  source: string
}

const RATE_LOWER = 30 // sanity bounds — anything outside is a parse error
const RATE_UPPER = 200

async function fetchFromBcrd(): Promise<RateSource | null> {
  // BCRD publishes daily exchange rates on their homepage. The HTML
  // layout has shifted before, so we cast a wide net: collect every
  // number-pair in the page that looks like a "Compra / Venta" cell
  // adjacent to USD-related copy, then pick the venta column.
  try {
    const res = await fetch('https://www.bancentral.gov.do/', {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MARELL/1.0; +https://marell.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    // Strategy 1 — explicit USD…Venta pairing. Most stable when the
    // homepage uses a structured table.
    const pairMatch = html.match(
      /USD[\s\S]{0,2000}?Venta[\s\S]{0,200}?>\s*([0-9]{2,3}[.,][0-9]{1,4})/i,
    )
    if (pairMatch) {
      const v = parseFloat(pairMatch[1].replace(',', '.'))
      if (Number.isFinite(v) && v > RATE_LOWER && v < RATE_UPPER) {
        return { rate: v, source: 'BCRD (scrape)' }
      }
    }

    // Strategy 2 — fall back to the highest plausible USD-rate-shaped
    // number in the page. BCRD usually shows venta > compra, so taking
    // the larger of the top-2 candidates avoids picking the buy rate.
    const candidates: number[] = []
    const re = /\b([4-9][0-9](?:[.,][0-9]{1,4})?)\b/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const n = parseFloat(m[1].replace(',', '.'))
      if (Number.isFinite(n) && n > RATE_LOWER && n < RATE_UPPER) {
        candidates.push(n)
      }
    }
    if (candidates.length >= 2) {
      candidates.sort((a, b) => a - b)
      // Use the median of top-3 to avoid picking up an outlier number
      // that happens to fall in the rate range but isn't FX.
      const top = candidates.slice(-3)
      const guess = top[Math.floor(top.length / 2)]
      return { rate: guess, source: 'BCRD (heuristic)' }
    }
  } catch {
    // network or parse failure — let the fallback handle it
  }
  return null
}

async function fetchFromOpenEr(): Promise<RateSource | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { rates?: Record<string, number> }
    const dop = json.rates?.DOP
    if (typeof dop === 'number' && dop > RATE_LOWER && dop < RATE_UPPER) {
      return { rate: dop, source: 'open.er-api.com' }
    }
  } catch {
    // give up
  }
  return null
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  type LockRpcArgs = { p_route: string; p_run_date: string }
  const lockResp = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: LockRpcArgs,
    ) => Promise<{ data: boolean | null; error: unknown }>
  }).rpc('acquire_cron_lock', {
    p_route: 'update-fx-rate',
    p_run_date: today,
  })
  if (!lockResp.data) {
    return NextResponse.json({ ok: true, deduped: true })
  }

  const result = (await fetchFromBcrd()) ?? (await fetchFromOpenEr())
  if (!result) {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa de ninguna fuente' },
      { status: 502 },
    )
  }

  // Round to 4 decimals to match the column precision (numeric(8,4)).
  const rate = Math.round(result.rate * 10000) / 10000
  const { data: updated, error } = await supabase
    .from('budgets')
    .update({ usd_to_dop_rate: rate } as never)
    .neq('id', '00000000-0000-0000-0000-000000000000') // touch every row
    .select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    rate,
    source: result.source,
    budgetsUpdated: updated?.length ?? 0,
    updatedAt: new Date().toISOString(),
  })
}
