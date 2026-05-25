'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { parseCSV, type ParseResult } from './csv'
import { detectBank, type BankDetection } from './bankDetectors'
import { bulkCreateTransactions, suggestCategoriesForPayees } from './actions'
import { suggestCategoryFromMerchantPattern } from './merchantPatterns'
import { useFormatMoney } from '../CurrencyProvider'
import { MONTH_NAMES_SHORT } from '@/lib/dates'
import { Button } from '@/components/ui/Button'
import { ModalHeader, ModalTitle } from '@/components/ui/ModalHeader'
import { Modal } from '@/components/ui/Modal'

interface AccountOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
  group_name: string
}

interface ImportTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: AccountOption[]
  categories: CategoryOption[]
}

// Per-row editable shape — overlay on top of the parsed rows so the user
// can correct payee names, assign categories, or drop rows before importing.
interface EditableRow {
  date: string
  payeeName: string
  amount: number
  memo: string | null
  categoryId: string | null
  // Source of the auto-assigned category, used to choose the badge variant.
  // 'history' = looked up from user's past categorizations
  // 'merchant' = matched a built-in DR merchant pattern
  // null = manual or no suggestion
  autoSource: 'history' | 'merchant' | null
  excluded: boolean
}

type SourceKind = 'csv' | 'pdf'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_NAMES_SHORT[date.getMonth()]}`
}

const CSV_MAX_BYTES = 5 * 1024 * 1024
const PDF_MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 1000

export function ImportTransactionsModal({
  isOpen,
  onClose,
  accounts,
  categories,
}: ImportTransactionsModalProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const [pending, startTransition] = useTransition()
  const [parsingPdf, setParsingPdf] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [csvSummary, setCsvSummary] = useState<ParseResult | null>(null)
  const [bankDetection, setBankDetection] = useState<BankDetection | null>(null)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  // Default category broadcast: applies to ALL rows when the user changes it.
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('')
  const [autoCount, setAutoCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setFile(null)
    setSourceKind(null)
    setRows([])
    setCsvSummary(null)
    setBankDetection(null)
    setAccountId(accounts[0]?.id ?? '')
    setDefaultCategoryId('')
    setAutoCount(0)
    setError(null)
    setDragOver(false)
    setParsingPdf(false)
  }, [isOpen, accounts])

  const groupedCategories = useMemo(() => {
    return categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
      const k = c.group_name
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
      return acc
    }, {})
  }, [categories])

  // After parsing (CSV or PDF), assign categories in this priority order:
  //   1) User's history — most reliable, reflects their actual habits
  //   2) Built-in DR merchant pattern dictionary — covers cold-start when
  //      the user has no history yet ("SUPERMIX" → Supermercado, etc.)
  //   3) Leave blank — user picks manually
  // Each matched row is tagged with the source so the badge UI can show
  // ✨ "según historial" vs 🏪 "según comercio".
  const applyCategorySuggestions = async (
    parsedRows: Omit<EditableRow, 'categoryId' | 'autoSource' | 'excluded'>[],
  ) => {
    const names = parsedRows.map((r) => r.payeeName)
    let historySuggestions: Record<string, string> = {}
    try {
      const result = await suggestCategoriesForPayees(names)
      historySuggestions = result.suggestions ?? {}
    } catch {
      // Best-effort — if the lookup fails, the user can still categorize
      // manually. Don't block the import preview on it.
    }
    const validCategoryIds = new Set(categories.map((c) => c.id))
    const catRefs = categories.map((c) => ({ id: c.id, name: c.name }))
    let matched = 0
    const enriched: EditableRow[] = parsedRows.map((r) => {
      // 1) History wins
      const fromHistory = historySuggestions[r.payeeName.trim()]
      if (fromHistory && validCategoryIds.has(fromHistory)) {
        matched++
        return {
          ...r,
          categoryId: fromHistory,
          autoSource: 'history',
          excluded: false,
        }
      }
      // 2) Merchant pattern fallback
      const fromMerchant = suggestCategoryFromMerchantPattern(r.payeeName, catRefs)
      if (fromMerchant && validCategoryIds.has(fromMerchant.categoryId)) {
        matched++
        return {
          ...r,
          categoryId: fromMerchant.categoryId,
          autoSource: 'merchant',
          excluded: false,
        }
      }
      return {
        ...r,
        categoryId: null,
        autoSource: null,
        excluded: false,
      }
    })
    setRows(enriched)
    setAutoCount(matched)
  }

  const handleCsv = async (f: File) => {
    setSourceKind('csv')
    const text = await f.text()
    const detection = detectBank(text)
    setBankDetection(detection.bank === 'unknown' ? null : detection)
    const result = parseCSV(text)
    if (result.rows.length > MAX_ROWS) {
      setError(
        `Demasiadas filas (${result.rows.length.toLocaleString('en-US')}). Máximo ${MAX_ROWS.toLocaleString('en-US')} por importación. Divide el archivo en varias partes.`,
      )
      setCsvSummary(null)
      return
    }
    setCsvSummary(result)
    await applyCategorySuggestions(
      result.rows.map((r) => ({
        date: r.date,
        payeeName: r.payeeName,
        amount: r.amount,
        memo: r.memo || null,
      })),
    )
  }

  const handlePdf = async (f: File) => {
    setSourceKind('pdf')
    setParsingPdf(true)
    try {
      const form = new FormData()
      form.append('pdf', f)
      const res = await fetch('/api/transactions/parse-pdf', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as
        | { transactions: Array<{ date: string; payeeName: string; amount: number; memo: string | null }> }
        | { error: string }
      if (!res.ok || 'error' in data) {
        setError(
          'error' in data
            ? data.error
            : 'No pudimos leer el PDF. Prueba con otro archivo o formato CSV.',
        )
        return
      }
      const parsed = data.transactions ?? []
      if (parsed.length === 0) {
        setError('No encontramos movimientos en este PDF.')
        return
      }
      if (parsed.length > MAX_ROWS) {
        setError(
          `Demasiados movimientos (${parsed.length.toLocaleString('en-US')}). Máximo ${MAX_ROWS.toLocaleString('en-US')} por importación.`,
        )
        return
      }
      await applyCategorySuggestions(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error leyendo el PDF')
    } finally {
      setParsingPdf(false)
    }
  }

  const handleFile = async (f: File) => {
    setError(null)
    const isCsv = f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
    const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    if (!isCsv && !isPdf) {
      setError('Solo archivos CSV o PDF.')
      return
    }
    const limit = isPdf ? PDF_MAX_BYTES : CSV_MAX_BYTES
    if (f.size > limit) {
      setError(
        isPdf
          ? 'PDF demasiado grande (máximo 10 MB).'
          : 'CSV demasiado grande (máximo 5 MB).',
      )
      return
    }
    setFile(f)
    try {
      if (isPdf) await handlePdf(f)
      else await handleCsv(f)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error leyendo el archivo')
    }
  }

  const resetFile = () => {
    setFile(null)
    setSourceKind(null)
    setRows([])
    setCsvSummary(null)
    setBankDetection(null)
    setAutoCount(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const applyDefaultCategoryToAll = (catId: string) => {
    setDefaultCategoryId(catId)
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        categoryId: catId || null,
        autoSource: null,
      })),
    )
  }

  const updateRow = (idx: number, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const handleImport = () => {
    if (rows.length === 0 || !accountId) return
    const toImport = rows.filter((r) => !r.excluded && r.payeeName.trim())
    if (toImport.length === 0) {
      setError('No hay transacciones que importar.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await bulkCreateTransactions({
        accountId,
        categoryId: defaultCategoryId || null,
        transactions: toImport.map((r) => ({
          date: r.date,
          payeeName: r.payeeName.trim(),
          amount: r.amount,
          memo: r.memo,
          categoryId: r.categoryId,
        })),
      })
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const totalKept = rows.filter((r) => !r.excluded).length
  const canImport = totalKept > 0 && accountId !== '' && !pending && !parsingPdf

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="import-tx-title"
      variant="center"
      size="3xl"
      maxHeight="92vh"
    >
      <ModalHeader onClose={onClose}>
          <ModalTitle
            id="import-tx-title"
            eyebrow="Importar transacciones"
            description={
              <>
                Acepta <span className="text-[var(--text2)]">CSV</span> y{' '}
                <span className="text-[var(--text2)]">PDF</span>. Las categorías se
                sugieren automáticamente con base en tu historial.
              </>
            }
          >
            Sube un <span className="gradient-text">estado de cuenta</span>
          </ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* File drop zone */}
          {!file && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed cursor-pointer transition-all p-10 text-center ${
                dragOver
                  ? 'border-[var(--brand-2)] bg-[rgba(61,220,151,0.05)]'
                  : 'border-[var(--border3)] hover:border-[var(--brand-2)]/60 hover:bg-[var(--overlay-1)]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mx-auto text-[#0B0B0C] mb-4">
                <Upload size={22} strokeWidth={2.4} />
              </div>
              <div className="text-[15px] font-semibold text-[var(--text)] mb-1">
                Arrastra tu archivo aquí
              </div>
              <div className="text-[12px] text-[var(--muted)]">
                o click para seleccionar (CSV o PDF)
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
            </div>
          )}

          {/* PDF parsing spinner */}
          {parsingPdf && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-[var(--brand-2)]/30 border-t-[var(--brand-2)] animate-spin" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text)]">
                  Leyendo PDF con IA…
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  Esto puede tardar 10-30 segundos según el tamaño.
                </div>
              </div>
            </div>
          )}

          {/* File summary */}
          {file && !parsingPdf && rows.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center text-[#0B0B0C] shrink-0">
                <FileText size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text)] truncate flex items-center gap-2 flex-wrap">
                  <span className="truncate">{file.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full bg-[var(--overlay-1)] text-[var(--text2)] border border-[var(--border)]">
                    {sourceKind === 'pdf' ? 'PDF · IA' : 'CSV'}
                  </span>
                  {bankDetection && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] border border-[var(--brand-2)]/20">
                      {bankDetection.displayName}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  {rows.length} {rows.length === 1 ? 'movimiento' : 'movimientos'}
                  {autoCount > 0 && (
                    <>
                      {' '}·{' '}
                      <span className="text-[var(--brand-text)] font-medium inline-flex items-center gap-1">
                        <Sparkles size={11} strokeWidth={2.4} />
                        {autoCount} categorizadas auto
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={resetFile}
                className="text-[12px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline px-2 py-1"
              >
                Cambiar archivo
              </button>
            </div>
          )}

          {/* CSV warnings */}
          {csvSummary && csvSummary.warnings.length > 0 && (
            <div className="space-y-2">
              {csvSummary.warnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--warn)]/40 bg-[rgba(245,200,66,0.06)] px-4 py-3 flex items-start gap-3"
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={2}
                    className="text-[var(--warn-text)] shrink-0 mt-0.5"
                  />
                  <div className="text-[13px] text-[var(--text)]">{w}</div>
                </div>
              ))}
            </div>
          )}

          {/* Account + bulk category selectors */}
          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Cuenta destino">
                  <NativeSelect value={accountId} onChange={setAccountId} ariaLabel="Cuenta">
                    {accounts.length === 0 ? (
                      <option value="" disabled>
                        Sin cuentas
                      </option>
                    ) : (
                      accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))
                    )}
                  </NativeSelect>
                </Field>
                <Field label="Aplicar categoría" hint="opcional, sobrescribe todas">
                  <NativeSelect
                    value={defaultCategoryId}
                    onChange={applyDefaultCategoryToAll}
                    ariaLabel="Aplicar a todas"
                  >
                    <option value="">— (mantener individuales)</option>
                    {Object.entries(groupedCategories).map(([groupName, cats]) => (
                      <optgroup key={groupName} label={groupName}>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              {/* Editable per-row list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-text)] font-semibold">
                    Movimientos ({totalKept})
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Click en categoría para asignar
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <ul className="divide-y divide-[var(--border)] max-h-[420px] overflow-y-auto">
                    {rows.map((r, i) => {
                      const isIncome = r.amount > 0
                      return (
                        <li
                          key={i}
                          className={`px-4 py-3 grid grid-cols-[56px_1fr_auto] gap-3 items-start transition-opacity ${
                            r.excluded ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="text-[11px] text-[var(--muted)] tabular-nums num pt-2">
                            {formatDate(r.date)}
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              {isIncome ? (
                                <ArrowUpRight
                                  size={12}
                                  strokeWidth={2}
                                  className="text-[var(--brand-text)] shrink-0"
                                />
                              ) : (
                                <ArrowDownRight
                                  size={12}
                                  strokeWidth={2}
                                  className="text-[var(--coral-text)] shrink-0"
                                />
                              )}
                              <input
                                type="text"
                                value={r.payeeName}
                                onChange={(e) =>
                                  updateRow(i, { payeeName: e.target.value })
                                }
                                disabled={r.excluded}
                                className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text)] border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-2)] focus:outline-none py-0.5"
                                aria-label={`Pagado a — fila ${i + 1}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <RowCategorySelect
                                value={r.categoryId ?? ''}
                                onChange={(v) =>
                                  updateRow(i, {
                                    categoryId: v || null,
                                    autoSource: null,
                                  })
                                }
                                groupedCategories={groupedCategories}
                                disabled={r.excluded}
                              />
                              {r.autoSource === 'history' && (
                                <span
                                  title="Categoría aprendida de tu historial"
                                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] border border-[var(--brand-2)]/20"
                                >
                                  <Sparkles size={9} strokeWidth={2.6} />
                                  historial
                                </span>
                              )}
                              {r.autoSource === 'merchant' && (
                                <span
                                  title="Sugerido por el tipo de comercio (banco de patrones RD)"
                                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--overlay-1)] text-[var(--text2)] border border-[var(--border2)]"
                                >
                                  <Sparkles size={9} strokeWidth={2.6} />
                                  comercio
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 pt-1">
                            <div
                              className={`text-[13px] tabular-nums num font-semibold ${
                                isIncome ? 'text-[var(--brand-text)]' : 'text-[var(--text)]'
                              }`}
                            >
                              {isIncome ? '+' : '−'}
                              {fmtMoney(r.amount)}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(i, { excluded: !r.excluded })
                              }
                              className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted)] hover:text-[var(--coral-text)] transition-colors"
                            >
                              {r.excluded ? 'incluir' : 'excluir'}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral-text)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--overlay-1)]">
          <Button
            type="button"
            variant="ghost"
            size="tight"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gradient"
            size="tight"
            onClick={handleImport}
            disabled={!canImport}
          >
            {pending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
                Importando…
              </>
            ) : rows.length > 0 ? (
              <>
                <CheckCircle2 size={14} strokeWidth={2.4} />
                Importar {totalKept} {totalKept === 1 ? 'transacción' : 'transacciones'}
              </>
            ) : (
              'Importar'
            )}
          </Button>
        </footer>
    </Modal>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
        {hint && <span className="text-[var(--muted)] font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full appearance-none !text-[14px] !py-3 !pl-4 !pr-10 !rounded-xl bg-[var(--s1)] cursor-pointer"
      >
        {children}
      </select>
      <svg
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text2)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

// Compact per-row select used inside the preview list. Smaller padding
// so it fits beside the payee/amount without forcing the row to grow.
function RowCategorySelect({
  value,
  onChange,
  groupedCategories,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  groupedCategories: Record<string, CategoryOption[]>
  disabled?: boolean
}) {
  return (
    <div className="relative inline-block min-w-0 flex-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Categoría"
        className="w-full appearance-none !text-[12px] !py-1.5 !pl-2.5 !pr-7 !rounded-md bg-[var(--overlay-1)] border border-[var(--border)] cursor-pointer hover:border-[var(--brand-2)]/40 disabled:cursor-not-allowed"
      >
        <option value="">Sin categoría</option>
        {Object.entries(groupedCategories).map(([groupName, cats]) => (
          <optgroup key={groupName} label={groupName}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text2)]"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
