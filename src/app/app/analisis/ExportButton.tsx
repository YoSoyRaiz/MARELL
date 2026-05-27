'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { fetchExportData } from './actions'

type Status = 'idle' | 'fetching' | 'building' | 'done' | 'error'

/**
 * Botón "Exportar" en el header de Análisis. Abre un modal con dos
 * opciones (PDF / CSV). Cada uno hace dynamic import de su librería
 * para que el bundle inicial no cargue 650KB de jspdf/jszip si el
 * usuario nunca exporta.
 */
export function ExportButton() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const run = async (format: 'pdf' | 'csv') => {
    setStatus('fetching')
    setErrorMsg(null)
    try {
      const data = await fetchExportData()
      if (data.error || !data.reports) {
        setErrorMsg(data.error ?? 'No hay data para exportar')
        setStatus('error')
        return
      }
      setStatus('building')
      const exporters = await import('./exporters')
      if (format === 'pdf') await exporters.exportToPDF(data)
      else await exporters.exportToCSV(data)
      setStatus('done')
      // Cierra después de un beat para que el usuario vea el ✓
      window.setTimeout(() => {
        setOpen(false)
        setStatus('idle')
      }, 1200)
    } catch (e) {
      console.error('Export error', e)
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
  }

  const busy = status === 'fetching' || status === 'building'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setStatus('idle')
          setErrorMsg(null)
        }}
        className="h-9 px-4 text-body-sm font-medium rounded-lg inline-flex items-center gap-2 text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] border border-[var(--border)] transition-colors whitespace-nowrap"
      >
        <Download size={14} strokeWidth={2.2} />
        Exportar
      </button>

      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        ariaLabelledBy="export-title"
        maxHeight="80vh"
      >
        <header className="px-6 pt-5 pb-3 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-eyebrow uppercase tracking-[0.18em] text-[var(--muted2)] font-semibold">
              Exportar análisis
            </div>
            <h2 id="export-title" className="text-h3 font-bold text-[var(--text)] mt-1">
              Los 5 reportes en un archivo
            </h2>
            <p className="text-meta text-[var(--muted)] mt-1 leading-relaxed">
              Gastos · Ingresos vs Gastos · Tendencias · Patrimonio · Edad del dinero
              <br />
              Período: últimos 12 meses (mes actual para Gastos).
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && setOpen(false)}
            disabled={busy}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--overlay-1)] flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-3">
          <FormatCard
            Icon={FileText}
            title="PDF"
            description="Documento de 6 páginas con portada, tablas y totales. Ideal para revisión por auditor o archivo permanente."
            ext=".pdf"
            onClick={() => run('pdf')}
            disabled={busy}
            highlight={status === 'building'}
          />
          <FormatCard
            Icon={FileSpreadsheet}
            title="CSV (ZIP)"
            description="5 archivos CSV + README en un .zip. Para análisis en Excel/Google Sheets o data pipelines."
            ext=".zip"
            onClick={() => run('csv')}
            disabled={busy}
            highlight={status === 'building'}
          />

          {status === 'fetching' && (
            <div className="text-center text-meta text-[var(--muted)] inline-flex items-center justify-center gap-2 w-full pt-2">
              <Spinner /> Recopilando data del servidor…
            </div>
          )}
          {status === 'building' && (
            <div className="text-center text-meta text-[var(--muted)] inline-flex items-center justify-center gap-2 w-full pt-2">
              <Spinner /> Generando archivo…
            </div>
          )}
          {status === 'done' && (
            <div className="text-center text-meta text-[var(--brand-text)] font-medium pt-2">
              ✓ Listo — revisa tus descargas
            </div>
          )}
          {status === 'error' && errorMsg && (
            <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-3.5 py-2.5 text-meta text-[var(--coral-text)]">
              {errorMsg}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

function FormatCard({
  Icon,
  title,
  description,
  ext,
  onClick,
  disabled,
  highlight,
}: {
  Icon: typeof Download
  title: string
  description: string
  ext: string
  onClick: () => void
  disabled: boolean
  highlight: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3 transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        highlight
          ? 'border-[var(--brand-2)]/40 bg-[rgba(61,220,151,0.04)]'
          : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)]'
      }`}
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--overlay-1)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-body-sm font-semibold text-[var(--text)] leading-tight inline-flex items-center gap-2">
          {title}
          <span className="text-tiny uppercase tracking-[0.15em] text-[var(--muted2)] font-medium">
            {ext}
          </span>
        </div>
        <div className="text-meta text-[var(--muted)] mt-1 leading-snug">
          {description}
        </div>
      </div>
    </button>
  )
}
