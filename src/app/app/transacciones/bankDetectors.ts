// Per-bank CSV detectors for Dominican Republic banks. Each detector
// scans the first ~10 lines of an uploaded file and returns a confidence
// score plus an optional column map override. The import modal picks the
// best match (if any) and surfaces "Detectamos: <Banco>" so the user
// knows we tailored the parser.
//
// Built from public statements + community-contributed samples. As we
// see real-world variants we should add them here. Detection is
// intentionally heuristic rather than strict so we degrade gracefully
// when banks tweak their export format.

export type DRBank =
  | 'popular'
  | 'banreservas'
  | 'bhd'
  | 'scotia'
  | 'promerica'
  | 'caribe'
  | 'bdi'
  | 'unknown'

export interface BankDetection {
  bank: DRBank
  /** Display name in Spanish. */
  displayName: string
  /** 0-1 confidence we got this right. */
  confidence: number
  /** Column overrides for the parser. Index of each known column in
   *  the header row. -1 when not present. */
  columnMap?: ColumnMap
  /** Hints for the user once detection succeeds. */
  hints?: string[]
}

export interface ColumnMap {
  date: number
  payee: number
  amount?: number
  debit?: number
  credit?: number
  memo?: number
  /** Some banks publish a separate "valor" column meaning a signed
   *  amount alongside debit/credit columns. We prefer signed when
   *  available. */
  signed?: number
}

export const BANK_LABELS: Record<DRBank, string> = {
  popular: 'Banco Popular',
  banreservas: 'Banreservas',
  bhd: 'BHD',
  scotia: 'Scotiabank',
  promerica: 'Promerica',
  caribe: 'Banco Caribe',
  bdi: 'BDI',
  unknown: 'Genérico',
}

interface DetectorContext {
  preview: string // raw text of the first ~10 lines
  headerLine: string
  headerCells: string[]
  delim: string
}

type Detector = (ctx: DetectorContext) => BankDetection | null

/**
 * Banco Popular: distinctive markers include "Banco Popular Dominicano"
 * appearing in the file header, columns named "Concepto"/"Detalle" plus
 * separate "Cargo"/"Abono", and many statements include the routing
 * number 0010xxxxx in metadata.
 */
const detectPopular: Detector = ({ preview, headerCells }) => {
  const lower = preview.toLowerCase()
  const hits = [
    /banco popular/i.test(preview),
    /popular dominicano/i.test(preview),
    /\bbpd\b/i.test(preview),
  ].filter(Boolean).length
  if (hits === 0) return null

  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /^(concepto|detalle|descripci[oó]n)/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /^(cargo|d[eé]bito|salida)/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /^(abono|cr[eé]dito|entrada)/i.test(h))

  return {
    bank: 'popular',
    displayName: BANK_LABELS.popular,
    confidence: Math.min(0.95, 0.5 + hits * 0.15 + (dateIdx >= 0 ? 0.1 : 0)),
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
    hints: lower.includes('tarjeta')
      ? ['Detectamos formato de tarjeta de crédito Popular.']
      : undefined,
  }
}

/**
 * Banreservas: their statements often start with "BANCO DE RESERVAS DE
 * LA REPÚBLICA DOMINICANA" or just "Banreservas". Standard column
 * triplet: Concepto / Débito / Crédito.
 */
const detectBanreservas: Detector = ({ preview, headerCells }) => {
  const hits = [
    /banreservas/i.test(preview),
    /banco de reservas/i.test(preview),
    /reservas de la rep[uú]blica/i.test(preview),
  ].filter(Boolean).length
  if (hits === 0) return null

  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /^(concepto|descripci[oó]n)/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /^d[eé]bito/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /^cr[eé]dito/i.test(h))

  return {
    bank: 'banreservas',
    displayName: BANK_LABELS.banreservas,
    confidence: Math.min(0.95, 0.55 + hits * 0.15),
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

/**
 * BHD: Common identifiers — "BHD León" or "Banco BHD". Their CSV uses
 * "Detalle" instead of "Descripción" and "Cargo"/"Abono" amounts.
 */
const detectBhd: Detector = ({ preview, headerCells }) => {
  const hits = [
    /\bbhd\b/i.test(preview),
    /bhd le[oó]n/i.test(preview),
  ].filter(Boolean).length
  if (hits === 0) return null

  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /^(detalle|descripci[oó]n|concepto)/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /^(cargo|d[eé]bito)/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /^(abono|cr[eé]dito)/i.test(h))

  return {
    bank: 'bhd',
    displayName: BANK_LABELS.bhd,
    confidence: Math.min(0.95, 0.55 + hits * 0.15),
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

/**
 * Scotiabank: bilingual headers. "Trans Date"/"Posting Date",
 * "Description", "Withdrawals"/"Deposits".
 */
const detectScotia: Detector = ({ preview, headerCells }) => {
  const hits = [
    /scotiabank/i.test(preview),
    /scotia/i.test(preview),
  ].filter(Boolean).length
  if (hits === 0) return null

  const dateIdx = headerCells.findIndex((h) =>
    /trans\s*date|posting\s*date|fecha/i.test(h),
  )
  const payeeIdx = headerCells.findIndex((h) =>
    /description|descripci[oó]n/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) =>
    /withdrawal|d[eé]bito|cargo/i.test(h),
  )
  const creditIdx = headerCells.findIndex((h) =>
    /deposit|cr[eé]dito|abono/i.test(h),
  )

  return {
    bank: 'scotia',
    displayName: BANK_LABELS.scotia,
    confidence: Math.min(0.95, 0.5 + hits * 0.2),
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

const detectPromerica: Detector = ({ preview, headerCells }) => {
  if (!/promerica/i.test(preview)) return null
  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /descripci[oó]n|concepto/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /d[eé]bito|cargo/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /cr[eé]dito|abono/i.test(h))
  return {
    bank: 'promerica',
    displayName: BANK_LABELS.promerica,
    confidence: 0.7,
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

const detectCaribe: Detector = ({ preview, headerCells }) => {
  if (!/banco\s*caribe/i.test(preview)) return null
  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /descripci[oó]n|concepto|detalle/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /d[eé]bito|cargo/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /cr[eé]dito|abono/i.test(h))
  return {
    bank: 'caribe',
    displayName: BANK_LABELS.caribe,
    confidence: 0.7,
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

const detectBdi: Detector = ({ preview, headerCells }) => {
  if (!/\bbdi\b|banco bdi/i.test(preview)) return null
  const dateIdx = headerCells.findIndex((h) => /^fecha/i.test(h))
  const payeeIdx = headerCells.findIndex((h) =>
    /descripci[oó]n|concepto|detalle/i.test(h),
  )
  const debitIdx = headerCells.findIndex((h) => /d[eé]bito|cargo/i.test(h))
  const creditIdx = headerCells.findIndex((h) => /cr[eé]dito|abono/i.test(h))
  return {
    bank: 'bdi',
    displayName: BANK_LABELS.bdi,
    confidence: 0.7,
    columnMap: {
      date: dateIdx,
      payee: payeeIdx,
      debit: debitIdx,
      credit: creditIdx,
    },
  }
}

const ALL_DETECTORS: Detector[] = [
  detectPopular,
  detectBanreservas,
  detectBhd,
  detectScotia,
  detectPromerica,
  detectCaribe,
  detectBdi,
]

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) ?? []).length
  const tab = (line.match(/\t/g) ?? []).length
  const comma = (line.match(/,/g) ?? []).length
  if (tab > comma && tab > semi) return '\t'
  if (semi > comma) return ';'
  return ','
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === delim) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

/**
 * Top-level detection. Strips empty leading lines, finds the most
 * likely header row, and runs all detectors against it. Picks the
 * highest-confidence match; returns 'unknown' (still parseable via the
 * generic detector) when nothing scores above 0.5.
 */
export function detectBank(rawText: string): BankDetection {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
  if (lines.length === 0) {
    return {
      bank: 'unknown',
      displayName: BANK_LABELS.unknown,
      confidence: 0,
    }
  }
  // Heuristic: the header is usually the first line with at least 3
  // delimiter-separated cells AND a "fecha"/"date" word in it.
  let headerIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const delim = detectDelimiter(lines[i])
    const cells = parseLine(lines[i], delim)
    if (cells.length >= 3 && /fecha|date/i.test(lines[i])) {
      headerIdx = i
      break
    }
  }
  const headerLine = lines[headerIdx]
  const delim = detectDelimiter(headerLine)
  const headerCells = parseLine(headerLine, delim)
  const ctx: DetectorContext = {
    preview: lines.join('\n'),
    headerLine,
    headerCells,
    delim,
  }

  let best: BankDetection | null = null
  for (const det of ALL_DETECTORS) {
    const r = det(ctx)
    if (r && (!best || r.confidence > best.confidence)) {
      best = r
    }
  }
  if (best && best.confidence >= 0.5) return best

  return {
    bank: 'unknown',
    displayName: BANK_LABELS.unknown,
    confidence: 0,
  }
}

export const SUPPORTED_BANKS: { id: DRBank; name: string }[] = [
  { id: 'popular', name: BANK_LABELS.popular },
  { id: 'banreservas', name: BANK_LABELS.banreservas },
  { id: 'bhd', name: BANK_LABELS.bhd },
  { id: 'scotia', name: BANK_LABELS.scotia },
  { id: 'promerica', name: BANK_LABELS.promerica },
  { id: 'caribe', name: BANK_LABELS.caribe },
  { id: 'bdi', name: BANK_LABELS.bdi },
]
