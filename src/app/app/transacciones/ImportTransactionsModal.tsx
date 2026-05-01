'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react'
import { parseCSV, type ParseResult } from './csv'
import { detectBank, type BankDetection } from './bankDetectors'
import { bulkCreateTransactions } from './actions'
import { useFormatMoney } from '../CurrencyProvider'

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

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]}`
}

export function ImportTransactionsModal({
  isOpen,
  onClose,
  accounts,
  categories,
}: ImportTransactionsModalProps) {
  const router = useRouter()
  const fmtMoney = useFormatMoney()
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [bankDetection, setBankDetection] = useState<BankDetection | null>(null)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setFile(null)
    setParseResult(null)
    setBankDetection(null)
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setError(null)
    setDragOver(false)
  }, [isOpen, accounts])

  // Esc + body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, c) => {
    const k = c.group_name
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  const handleFile = async (f: File) => {
    setError(null)
    if (f.size > 5 * 1024 * 1024) {
      setError('Archivo demasiado grande (máximo 5 MB).')
      return
    }
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      setError('Solo archivos CSV.')
      return
    }
    setFile(f)
    try {
      const text = await f.text()
      // Detect the bank first so we can surface a "Detectamos: X" pill
      // and (in the future) feed bank-specific parsing back into csv.ts.
      const detection = detectBank(text)
      setBankDetection(detection.bank === 'unknown' ? null : detection)
      const result = parseCSV(text)
      // Hard cap row count to match the server's `bulkCreateTransactions`
      // 1,000-row limit — surfacing the error here saves a round trip
      // and lets us suggest splitting the file before they hit Import.
      const MAX_ROWS = 1000
      if (result.rows.length > MAX_ROWS) {
        setError(
          `Demasiadas filas (${result.rows.length.toLocaleString('en-US')}). Máximo ${MAX_ROWS.toLocaleString('en-US')} por importación. Divide el archivo en varias partes.`,
        )
        setParseResult(null)
        return
      }
      setParseResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error leyendo el archivo')
    }
  }

  const handleImport = () => {
    if (!parseResult || parseResult.rows.length === 0 || !accountId) return
    setError(null)
    startTransition(async () => {
      const result = await bulkCreateTransactions({
        accountId,
        categoryId: categoryId || null,
        transactions: parseResult.rows.map((r) => ({
          date: r.date,
          payeeName: r.payeeName,
          amount: r.amount,
          memo: r.memo || null,
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

  const canImport =
    parseResult !== null && parseResult.rows.length > 0 && accountId !== '' && !pending

  const previewRows = parseResult?.rows.slice(0, 10) ?? []
  const remaining = parseResult ? parseResult.rows.length - previewRows.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-tx-title"
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              Importar CSV
            </div>
            <h2
              id="import-tx-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              Sube un <span className="gradient-text">estado de cuenta</span>
            </h2>
            <div className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              Detecto automáticamente columnas como{' '}
              <span className="text-[var(--text2)]">Fecha</span>,{' '}
              <span className="text-[var(--text2)]">Descripción</span>,{' '}
              <span className="text-[var(--text2)]">Monto</span> o{' '}
              <span className="text-[var(--text2)]">Débito/Crédito</span>.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] flex items-center justify-center transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* File drop zone */}
          {!parseResult && (
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
                  : 'border-[var(--border3)] hover:border-[var(--brand-2)]/60 hover:bg-white/[0.02]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mx-auto text-[#0B0B0C] mb-4">
                <Upload size={22} strokeWidth={2.4} />
              </div>
              <div className="text-[15px] font-semibold text-[var(--text)] mb-1">
                Arrastra tu archivo aquí
              </div>
              <div className="text-[12px] text-[var(--muted)]">
                o click para seleccionar (CSV, máx. 5 MB)
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
            </div>
          )}

          {/* File summary */}
          {file && parseResult && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center text-[#0B0B0C] shrink-0">
                <FileText size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--text)] truncate flex items-center gap-2 flex-wrap">
                  <span className="truncate">{file.name}</span>
                  {bankDetection && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full bg-[rgba(61,220,151,0.12)] text-[var(--brand-2)] border border-[var(--brand-2)]/20">
                      Detectamos {bankDetection.displayName}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">
                  {parseResult.totalRows} filas leídas ·{' '}
                  <span className="text-[var(--brand-2)] font-medium">
                    {parseResult.rows.length} listas
                  </span>
                  {parseResult.skippedRows > 0 && (
                    <>
                      {' '}
                      · {parseResult.skippedRows} omitidas
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setParseResult(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                className="text-[12px] text-[var(--muted)] hover:text-[var(--text)] underline-offset-4 hover:underline px-2 py-1"
              >
                Cambiar archivo
              </button>
            </div>
          )}

          {/* Warnings */}
          {parseResult && parseResult.warnings.length > 0 && (
            <div className="space-y-2">
              {parseResult.warnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--warn)]/40 bg-[rgba(245,200,66,0.06)] px-4 py-3 flex items-start gap-3"
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={2}
                    className="text-[var(--warn)] shrink-0 mt-0.5"
                  />
                  <div className="text-[13px] text-[var(--text)]">{w}</div>
                </div>
              ))}
            </div>
          )}

          {/* Account + category selectors (only when we have rows) */}
          {parseResult && parseResult.rows.length > 0 && (
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
                <Field label="Categoría" hint="opcional, se aplica a todas">
                  <NativeSelect value={categoryId} onChange={setCategoryId} ariaLabel="Categoría">
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
                  </NativeSelect>
                </Field>
              </div>

              {/* Preview list */}
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-2)] font-semibold mb-2">
                  Vista previa
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <ul className="divide-y divide-[var(--border)] max-h-[260px] overflow-y-auto">
                    {previewRows.map((r, i) => {
                      const isIncome = r.amount > 0
                      return (
                        <li
                          key={i}
                          className="px-4 py-2.5 grid grid-cols-[60px_1fr_auto] gap-3 items-center"
                        >
                          <div className="text-[11px] text-[var(--muted)] tabular-nums num">
                            {formatDate(r.date)}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            {isIncome ? (
                              <ArrowUpRight
                                size={12}
                                strokeWidth={2}
                                className="text-[var(--brand-2)] shrink-0"
                              />
                            ) : (
                              <ArrowDownRight
                                size={12}
                                strokeWidth={2}
                                className="text-[var(--coral)] shrink-0"
                              />
                            )}
                            <span className="text-[13px] text-[var(--text)] truncate">
                              {r.payeeName}
                            </span>
                          </div>
                          <div
                            className={`text-[13px] tabular-nums num font-semibold ${
                              isIncome ? 'text-[var(--brand-2)]' : 'text-[var(--text)]'
                            }`}
                          >
                            {isIncome ? '+' : '−'}
                            {fmtMoney(r.amount)}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {remaining > 0 && (
                    <div className="px-4 py-2.5 text-[11px] text-[var(--muted)] border-t border-[var(--border)] text-center">
                      + {remaining}{' '}
                      {remaining === 1 ? 'transacción más' : 'transacciones más'}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3">
              <AlertCircle size={16} strokeWidth={2} className="text-[var(--coral)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--text)] flex-1">{error}</div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 px-4 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="h-10 px-5 gradient-bg text-[#0B0B0C] font-semibold text-[13px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 transition-[filter] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
          >
            {pending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
                Importando...
              </>
            ) : parseResult ? (
              <>
                <CheckCircle2 size={14} strokeWidth={2.4} />
                Importar {parseResult.rows.length}{' '}
                {parseResult.rows.length === 1 ? 'transacción' : 'transacciones'}
              </>
            ) : (
              'Importar'
            )}
          </button>
        </footer>
      </div>
    </div>
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
