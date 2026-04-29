export interface ParsedRow {
  date: string // YYYY-MM-DD
  payeeName: string
  amount: number // signed: + income, - expense
  memo: string
}

export interface ParseResult {
  rows: ParsedRow[]
  totalRows: number
  skippedRows: number
  warnings: string[]
}

// Header keywords — match common Spanish + English bank statement column names
const HEADER_DATE = /^(date|fecha)$/i
const HEADER_PAYEE = /^(description|descripcion|descripci[oó]n|payee|concepto|comercio|merchant|detalle|beneficiario)$/i
const HEADER_AMOUNT = /^(amount|monto|importe|valor|total)$/i
const HEADER_DEBIT = /^(debit|debito|d[eé]bito|cargo|salida|expense|gasto|retiro)$/i
const HEADER_CREDIT = /^(credit|credito|cr[eé]dito|abono|entrada|income|ingreso|deposit|dep[oó]sito)$/i
const HEADER_MEMO = /^(memo|note|nota|referencia|reference|observ)/i

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) ?? []).length
  const tab = (line.match(/\t/g) ?? []).length
  const comma = (line.match(/,/g) ?? []).length
  if (tab > comma && tab > semi) return '\t'
  if (semi > comma) return ';'
  return ','
}

function parseCSVLine(line: string, delim: string): string[] {
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
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === delim) {
        out.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  // YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  // DD/MM/YYYY or DD-MM-YYYY (DR / Latin default)
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s)
  if (m) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    const year = m[3]
    // If first segment > 12, it must be DD; otherwise prefer DD/MM (DR convention).
    if (a > 12) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
    }
    return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`
  }
  return null
}

function parseAmount(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null
  // Parentheses indicate negative (accounting style)
  const parenNeg = s.startsWith('(') && s.endsWith(')')
  if (parenNeg) s = s.slice(1, -1).trim()
  // Strip currency symbols and spaces
  s = s.replace(/[$€£¥]/g, '').replace(/\s/g, '')
  if (!s) return null
  // Decide which separator is decimal
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // The rightmost separator is the decimal one
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // European: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Either European decimal or thousands; pick by digits after last comma
    const after = s.split(',').pop() ?? ''
    if (after.length <= 2) {
      s = s.replace(/,/g, '.')
    } else {
      s = s.replace(/,/g, '')
    }
  }
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return parenNeg ? -Math.abs(n) : n
}

export function parseCSV(text: string): ParseResult {
  const warnings: string[] = []
  // Strip BOM and split
  const cleaned = text.replace(/^﻿/, '')
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      skippedRows: 0,
      warnings: ['El archivo está vacío o solo tiene la fila de encabezados.'],
    }
  }

  const delim = detectDelimiter(lines[0])
  const headerCells = parseCSVLine(lines[0], delim).map((h) => h.trim())

  const dateIdx = headerCells.findIndex((h) => HEADER_DATE.test(h))
  const payeeIdx = headerCells.findIndex((h) => HEADER_PAYEE.test(h))
  const amountIdx = headerCells.findIndex((h) => HEADER_AMOUNT.test(h))
  const debitIdx = headerCells.findIndex((h) => HEADER_DEBIT.test(h))
  const creditIdx = headerCells.findIndex((h) => HEADER_CREDIT.test(h))
  const memoIdx = headerCells.findIndex((h) => HEADER_MEMO.test(h))

  if (dateIdx === -1) {
    return {
      rows: [],
      totalRows: lines.length - 1,
      skippedRows: lines.length - 1,
      warnings: [
        'No encontré una columna de fecha. Asegúrate que el CSV tenga un encabezado como "Fecha" o "Date".',
      ],
    }
  }
  if (payeeIdx === -1) {
    return {
      rows: [],
      totalRows: lines.length - 1,
      skippedRows: lines.length - 1,
      warnings: [
        'No encontré una columna de descripción. Esperado: "Descripción", "Concepto", "Detalle", "Description" o "Payee".',
      ],
    }
  }

  const useDebitCredit = amountIdx === -1 && debitIdx !== -1 && creditIdx !== -1

  if (amountIdx === -1 && !useDebitCredit) {
    return {
      rows: [],
      totalRows: lines.length - 1,
      skippedRows: lines.length - 1,
      warnings: [
        'No encontré columna de monto. Esperado: "Monto"/"Amount" en una sola columna, o "Débito" + "Crédito" por separado.',
      ],
    }
  }

  const rows: ParsedRow[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delim)

    const date = parseDate(cells[dateIdx] ?? '')
    if (!date) {
      skipped++
      continue
    }

    const payeeName = (cells[payeeIdx] ?? '').trim()
    if (!payeeName) {
      skipped++
      continue
    }

    let amount: number | null = null
    if (useDebitCredit) {
      const debit = parseAmount(cells[debitIdx] ?? '')
      const credit = parseAmount(cells[creditIdx] ?? '')
      if (debit !== null && Math.abs(debit) > 0.005) {
        amount = -Math.abs(debit)
      } else if (credit !== null && Math.abs(credit) > 0.005) {
        amount = Math.abs(credit)
      }
    } else {
      amount = parseAmount(cells[amountIdx] ?? '')
    }

    if (amount === null || Math.abs(amount) < 0.005) {
      skipped++
      continue
    }

    const memo = memoIdx !== -1 ? (cells[memoIdx] ?? '').trim() : ''

    rows.push({ date, payeeName, amount, memo })
  }

  if (skipped > 0) {
    warnings.push(
      `${skipped} ${skipped === 1 ? 'fila omitida' : 'filas omitidas'} por datos incompletos o inválidos.`,
    )
  }

  return { rows, totalRows: lines.length - 1, skippedRows: skipped, warnings }
}
