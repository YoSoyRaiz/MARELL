'use client'

import { useState } from 'react'
import { FileUp, FileText, Sparkles, AlertCircle, Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { parseCSV } from '@/app/app/transacciones/csv'
import {
  aggregatePayeesToCategories,
  type CategoryGroupSeed,
} from '@/lib/categories/aggregate-from-payees'

const PDF_MAX_BYTES = 10 * 1024 * 1024
const CSV_MAX_BYTES = 5 * 1024 * 1024

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Callback con la lista de grupos+categorías detectadas. Se cierra
   *  el modal automáticamente después de invocar. */
  onCategoriesGenerated: (groups: CategoryGroupSeed[]) => void
}

/**
 * Modal del wizard "Nuevo cliente" que sube un estado de cuenta
 * (PDF o CSV), extrae los payees y devuelve una propuesta de
 * category_groups + categorías al wizard. NO importa transacciones —
 * en este flow el budget del cliente aún no existe, así que las txns
 * se descartan; lo único que aprovechamos es la señal de "qué tipos
 * de gasto tiene esta persona" para sembrar su plan.
 *
 * Mantenemos el modal aparte del ImportTransactionsModal de Resumen
 * porque el flow es muy distinto (sin account selector, sin edición
 * de rows, sin default category). Compartimos solo: parser CSV +
 * endpoint PDF + dictionary RD via aggregatePayeesToCategories.
 */
export function ImportCategoriesFromStatementModal({
  isOpen,
  onClose,
  onCategoriesGenerated,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CategoryGroupSeed[] | null>(null)
  const [keptGroups, setKeptGroups] = useState<Set<string>>(new Set())

  const reset = () => {
    setFile(null)
    setParsing(false)
    setError(null)
    setPreview(null)
    setKeptGroups(new Set())
  }

  const handleFile = async (f: File) => {
    setError(null)
    setPreview(null)
    const isCsv = f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
    const isPdf =
      f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    if (!isCsv && !isPdf) {
      setError('Solo archivos PDF o CSV.')
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
    setParsing(true)
    try {
      let payees: string[] = []
      if (isCsv) {
        const text = await f.text()
        const result = parseCSV(text)
        payees = result.rows.map((r) => r.payeeName).filter(Boolean)
      } else {
        const form = new FormData()
        form.append('pdf', f)
        const res = await fetch('/api/transactions/parse-pdf', {
          method: 'POST',
          body: form,
        })
        const data = (await res.json()) as
          | {
              transactions: Array<{ payeeName: string }>
            }
          | { error: string; message?: string }
        if (!res.ok || 'error' in data) {
          const msg =
            'error' in data
              ? data.message ?? data.error
              : 'No pudimos leer el PDF.'
          setError(msg)
          return
        }
        payees = (data.transactions ?? [])
          .map((t) => t.payeeName)
          .filter(Boolean)
      }

      if (payees.length === 0) {
        setError(
          'No detectamos movimientos en el archivo. Prueba con otro estado de cuenta.',
        )
        return
      }

      const groups = aggregatePayeesToCategories(payees)
      setPreview(groups)
      setKeptGroups(new Set(groups.map((g) => g.name)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error procesando archivo')
    } finally {
      setParsing(false)
    }
  }

  const toggleGroup = (name: string) => {
    setKeptGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleConfirm = () => {
    if (!preview) return
    const kept = preview.filter((g) => keptGroups.has(g.name))
    onCategoriesGenerated(kept)
    reset()
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="import-categories-title"
      size="2xl"
      scrollable
    >
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
        <h2
          id="import-categories-title"
          className="text-h3 font-bold text-[var(--text)] inline-flex items-center gap-2"
        >
          <Sparkles size={16} strokeWidth={2.4} className="text-[var(--brand-2)]" />
          Importar estado de cuenta
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="text-[var(--muted)] hover:text-[var(--text)]"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
      <p className="px-6 text-body-sm text-[var(--text2)] leading-relaxed">
        Subimos el estado de cuenta del cliente y detectamos automáticamente
        las categorías que necesita en su plan. No guardamos las transacciones
        — solo usamos los nombres de comercios para sugerir categorías.
      </p>

      <div className="px-6 py-5">
        {!preview && (
          <label
            htmlFor="statement-file"
            className={`block rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-8 text-center cursor-pointer hover:border-[var(--brand-2)]/40 transition-colors ${
              parsing ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <input
              id="statement-file"
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
              disabled={parsing}
            />
            <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--brand-2)]/[0.10] text-[var(--brand-text)] flex items-center justify-center mb-3">
              <FileUp size={22} strokeWidth={2} />
            </div>
            <p className="text-body font-semibold text-[var(--text)]">
              {parsing
                ? 'Procesando…'
                : file
                  ? file.name
                  : 'Arrastra el archivo o haz click'}
            </p>
            <p className="mt-1 text-meta text-[var(--muted)]">
              PDF (máx. 10 MB) · CSV (máx. 5 MB)
            </p>
          </label>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/[0.08] px-4 py-3 inline-flex items-start gap-2 w-full text-body-sm text-[var(--coral-text)]">
            <AlertCircle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/[0.08] px-4 py-3 inline-flex items-start gap-2 w-full text-body-sm text-[var(--success)]">
              <Check size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
              <div>
                Detectamos{' '}
                <strong>
                  {preview.reduce((s, g) => s + g.categoryNames.length, 0)}{' '}
                  categorías
                </strong>{' '}
                en {preview.length}{' '}
                {preview.length === 1 ? 'grupo' : 'grupos'}. Deselecciona los
                grupos que no quieras incluir.
              </div>
            </div>

            <div className="space-y-3">
              {preview.map((g) => {
                const kept = keptGroups.has(g.name)
                return (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => toggleGroup(g.name)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      kept
                        ? 'border-[var(--brand-2)]/40 bg-[var(--brand-2)]/[0.05]'
                        : 'border-[var(--border)] bg-[var(--bg)] opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`size-4 rounded-md border ${
                            kept
                              ? 'bg-[var(--brand-2)] border-[var(--brand-2)]'
                              : 'border-[var(--border)]'
                          } flex items-center justify-center`}
                        >
                          {kept && (
                            <Check size={10} strokeWidth={3} className="text-[#0B0B0C]" />
                          )}
                        </span>
                        <span className="font-semibold text-[var(--text)]">
                          {g.name}
                        </span>
                      </div>
                      <span className="text-meta text-[var(--muted)]">
                        {g.categoryNames.length}{' '}
                        {g.categoryNames.length === 1 ? 'categoría' : 'categorías'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.categoryNames.map((c) => (
                        <span
                          key={c}
                          className="text-tiny px-2 py-0.5 rounded-md bg-[var(--overlay-2)] text-[var(--text2)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  setFile(null)
                }}
                className="h-10 px-4 text-body-sm font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-xl inline-flex items-center gap-2"
              >
                <FileText size={14} strokeWidth={2.2} />
                Subir otro archivo
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={keptGroups.size === 0}
                className="ml-auto h-10 px-5 gradient-bg text-[#0B0B0C] text-body-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none hover:brightness-105 transition-[filter]"
              >
                Usar estas categorías
                <Check size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
