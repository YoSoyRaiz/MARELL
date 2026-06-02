// Helper puro: dado un archivo de estado de cuenta (PDF o CSV) y sus
// txns parseadas, infiere la cuenta default que sugerimos crear
// (nombre, tipo, moneda). El auditor siempre puede editar el resultado
// antes de confirmar.
//
// Para CSV reusamos `detectBank()` del parser existente (analiza el
// texto crudo). Para PDF — no tenemos texto crudo accesible al cliente,
// así que detectamos por nombre de archivo + heurísticas sobre las
// txns parseadas (todas negativas + monto alto → probable tarjeta).

import {
  BANK_LABELS,
  detectBank,
  type DRBank,
} from '@/app/app/transacciones/bankDetectors'

export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'credit_card'
  | 'asset'

export interface ParsedTxnForInference {
  amount: number
}

export interface AccountInferenceInput {
  fileName: string
  fileType: 'pdf' | 'csv'
  /** Solo presente para CSV — para PDF queda undefined. */
  rawText?: string
  txns: ParsedTxnForInference[]
}

export interface AccountInferenceResult {
  bank: DRBank
  bankDisplayName: string
  accountNameDefault: string
  accountTypeDefault: AccountType
  currencyDefault: 'DOP' | 'USD'
}

// Patrones para detectar banco desde el filename de un PDF.
// Orden importa: matches más específicos primero.
const PDF_BANK_FILENAME_PATTERNS: Array<{ regex: RegExp; bank: DRBank }> = [
  { regex: /\bbanreservas\b|\bbreservas\b/i, bank: 'banreservas' },
  { regex: /\bpopular\b|\bbpd\b/i, bank: 'popular' },
  { regex: /\bbhd\b|bhd[\s_-]?le[oó]n/i, bank: 'bhd' },
  { regex: /\bscotia\b|scotiabank/i, bank: 'scotia' },
  { regex: /\bpromerica\b/i, bank: 'promerica' },
  { regex: /\bcaribe\b/i, bank: 'caribe' },
  { regex: /\bbdi\b/i, bank: 'bdi' },
]

const CREDIT_CARD_HINTS =
  /tarjeta|credit\s*card|\bcc\b|\bvisa\b|mastercard|amex|master\s*card/i

const USD_HINTS = /\busd?\b|d[oó]lares|\bus\$/i

function detectBankFromPdfFilename(fileName: string): DRBank {
  for (const { regex, bank } of PDF_BANK_FILENAME_PATTERNS) {
    if (regex.test(fileName)) return bank
  }
  return 'unknown'
}

/**
 * Devuelve la propuesta de cuenta para un archivo importado. El auditor
 * puede sobreescribir cualquier campo en la UI antes de confirmar.
 */
export function inferAccountFromFile(
  input: AccountInferenceInput,
): AccountInferenceResult {
  let bank: DRBank = 'unknown'

  if (input.fileType === 'csv' && input.rawText) {
    const det = detectBank(input.rawText)
    bank = det.bank
  } else {
    bank = detectBankFromPdfFilename(input.fileName)
  }

  const bankDisplayName = BANK_LABELS[bank]

  // Heurísticas para credit card:
  // 1) Filename menciona tarjeta/visa/mastercard
  // 2) Si NO hay match en (1) pero todos los amounts son negativos y
  //    suman > 50K negativo, es probable tarjeta (rare false positive
  //    porque casi todos los estados tienen al menos un crédito/abono).
  let accountTypeDefault: AccountType = 'checking'
  const filenameSaysCard = CREDIT_CARD_HINTS.test(input.fileName)
  if (filenameSaysCard) {
    accountTypeDefault = 'credit_card'
  } else if (input.txns.length > 0) {
    const allNegative = input.txns.every((t) => t.amount <= 0)
    const totalAbs = input.txns.reduce((s, t) => s + Math.abs(t.amount), 0)
    if (allNegative && totalAbs > 50_000) {
      accountTypeDefault = 'credit_card'
    }
  }

  // Moneda: USD si el filename o rawText insinúa dólares; default DOP.
  let currencyDefault: 'DOP' | 'USD' = 'DOP'
  if (USD_HINTS.test(input.fileName)) {
    currencyDefault = 'USD'
  } else if (input.rawText && USD_HINTS.test(input.rawText.slice(0, 4000))) {
    currencyDefault = 'USD'
  }

  // Nombre default: si el banco es conocido, usar su label; sino el
  // filename sin extensión.
  const stem = input.fileName.replace(/\.[^.]+$/, '').trim()
  const accountNameDefault =
    bank === 'unknown' ? stem || 'Cuenta importada' : bankDisplayName

  return {
    bank,
    bankDisplayName,
    accountNameDefault,
    accountTypeDefault,
    currencyDefault,
  }
}
