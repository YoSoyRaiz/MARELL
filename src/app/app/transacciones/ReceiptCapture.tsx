'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface ParsedReceipt {
  amount: number | null
  date: string | null
  payee: string | null
  currency: 'DOP' | 'USD' | null
  confidence: 'high' | 'medium' | 'low'
}

interface UsageInfo {
  used: number
  limit: number
}

interface ReceiptCaptureProps {
  /** Existing receipt URL (when editing). */
  initialUrl?: string | null
  /** Existing path inside the bucket (when editing) — used to remove
   *  the previous file on replace/clear. */
  initialPath?: string | null
  /** Fires whenever the receipt changes. Called with `{ url, path }`
   *  on upload/replace and with `null` on remove. */
  onChange: (next: { url: string; path: string } | null) => void
  /** Fires once vision OCR returns. Form uses this to pre-fill amount,
   *  date and payee. Only called on a fresh upload, not on remove. */
  onParsed?: (parsed: ParsedReceipt) => void
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Receipt photo capture / preview component.
 *
 * On mobile (`capture="environment"` on the input), tapping the
 * trigger opens the rear-facing camera directly so the user can snap
 * a receipt without going through a gallery picker. On desktop the
 * same input falls back to the file dialog.
 *
 * Files are uploaded directly from the browser to Supabase Storage
 * under the `receipts/<user.id>/<uuid>.<ext>` key. RLS in storage
 * scopes access to the owner only.
 */
export function ReceiptCapture({
  initialUrl,
  initialPath,
  onChange,
  onParsed,
}: ReceiptCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [path, setPath] = useState<string | null>(initialPath ?? null)
  const [pending, setPending] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseHint, setParseHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [quotaHit, setQuotaHit] = useState(false)

  // Pull current month's OCR usage so the user sees "X/N restantes"
  // before they take a photo. Plan-aware on the server side.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const [usageResp, profileResp] = await Promise.all([
          supabase.rpc('get_ocr_usage').single<{
            used: number
            year_month: string
          }>(),
          supabase.from('profiles').select('plan').eq('id', user.id).single(),
        ])
        if (cancelled || !usageResp.data) return
        const plan = (profileResp.data?.plan as string | null) ?? 'free'
        const planLimit = plan === 'pro' ? 50 : plan === 'trial' ? 15 : 3
        setUsage({ used: usageResp.data.used, limit: planLimit })
      } catch {
        // Non-fatal — the UI just won't show the counter.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Send the photo to /api/receipts/parse and forward the JSON to the
  // parent form. Failures are silent — the user can still type the
  // fields manually. Runs concurrently with the storage upload so the
  // total wait is whichever takes longer.
  const runParse = async (file: File) => {
    if (!onParsed) return
    setParsing(true)
    setParseHint(null)
    setQuotaHit(false)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const resp = await fetch('/api/receipts/parse', {
        method: 'POST',
        body: fd,
      })
      if (resp.status === 429) {
        const body = (await resp.json().catch(() => ({}))) as {
          used?: number
          limit?: number
        }
        if (body.used !== undefined && body.limit !== undefined) {
          setUsage({ used: body.used, limit: body.limit })
        }
        setQuotaHit(true)
        return
      }
      if (resp.status === 413) {
        // Too large for vision — the upload still succeeds, we just
        // can't run OCR on it. Show the same hint as quota-hit.
        setQuotaHit(true)
        return
      }
      if (!resp.ok) return
      const json = (await resp.json()) as ParsedReceipt & {
        used?: number
        limit?: number
      }
      if (json.used !== undefined && json.limit !== undefined) {
        setUsage({ used: json.used, limit: json.limit })
      }
      onParsed(json)
      const fields: string[] = []
      if (json.amount !== null) fields.push('monto')
      if (json.date) fields.push('fecha')
      if (json.payee) fields.push('comercio')
      if (fields.length > 0) {
        setParseHint(`Detectado: ${fields.join(' · ')}`)
      }
    } catch {
      // Network or parse error — ignore. The user types manually.
    } finally {
      setParsing(false)
    }
  }

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setError('Imagen demasiado grande (máx. 5 MB).')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Solo imágenes (JPG, PNG, HEIC).')
      return
    }
    setError(null)
    setPending(true)
    // Kick off vision OCR in parallel with the storage upload.
    void runParse(file)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No autenticado')
        setPending(false)
        return
      }

      // If we're replacing, remove the previous file first so we don't
      // leave orphan blobs in the bucket.
      if (path) {
        await supabase.storage.from('receipts').remove([path])
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const key = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(key, file, {
          contentType: file.type,
          upsert: false,
        })
      if (upErr) {
        setError(upErr.message)
        setPending(false)
        return
      }
      // Generate a signed URL for display. 1 year is fine — when the
      // transaction is deleted we'll wipe the underlying file.
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(key, 60 * 60 * 24 * 365)
      const newUrl = signed?.signedUrl ?? ''
      setUrl(newUrl)
      setPath(key)
      onChange({ url: newUrl, path: key })
    } finally {
      setPending(false)
    }
  }

  const handleRemove = async () => {
    if (!path) {
      setUrl(null)
      onChange(null)
      return
    }
    setPending(true)
    try {
      const supabase = createClient()
      await supabase.storage.from('receipts').remove([path])
      setUrl(null)
      setPath(null)
      onChange(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // capture="environment" tells mobile browsers to open the rear
        // camera directly. Desktop browsers ignore it and just show
        // the file picker. Both work.
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />

      {url ? (
        <div className="relative rounded-2xl overflow-hidden border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Recibo adjunto"
            className="w-full max-h-64 object-cover"
          />
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--scrim)] backdrop-blur-sm text-white hover:bg-[var(--scrim)] flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Reemplazar foto"
            >
              <Camera size={18} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--scrim)] backdrop-blur-sm text-[var(--coral-text)] hover:bg-[var(--scrim)] flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Quitar foto"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
          <div
            className={`px-4 py-2 border-t text-[12px] font-medium inline-flex items-center gap-1.5 w-full ${
              quotaHit
                ? 'bg-[rgba(245,200,66,0.10)] border-[var(--warn)]/20 text-[var(--warn-text)]'
                : 'bg-[rgba(61,220,151,0.10)] border-[var(--brand-2)]/20 text-[var(--brand-text)]'
            }`}
          >
            {parsing ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-[var(--brand-2)]/40 border-t-[var(--brand-2)] animate-spin" />
                Leyendo recibo…
              </>
            ) : quotaHit ? (
              <>
                <Sparkles size={12} strokeWidth={2.4} />
                Límite mensual de OCR alcanzado · escribe los datos a mano
              </>
            ) : parseHint ? (
              <>
                <Sparkles size={12} strokeWidth={2.4} />
                {parseHint}
              </>
            ) : (
              <>
                <Camera size={12} strokeWidth={2.4} />
                Recibo guardado
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="w-full rounded-2xl border-2 border-dashed border-[var(--brand-2)]/40 bg-[rgba(61,220,151,0.04)] hover:bg-[rgba(61,220,151,0.08)] hover:border-[var(--brand-2)]/60 active:scale-[0.99] px-5 py-5 flex items-center gap-4 transition-all disabled:opacity-60"
        >
          <div className="w-14 h-14 rounded-2xl gradient-bg text-[#0B0B0C] flex items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(61,220,151,0.35)]">
            {pending ? (
              <span className="inline-block w-5 h-5 rounded-full border-[2.5px] border-[#0B0B0C]/30 border-t-[#0B0B0C] animate-spin" />
            ) : (
              <Camera size={22} strokeWidth={2.4} />
            )}
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="text-[15px] font-bold text-[var(--text)]">
                {pending ? 'Subiendo…' : 'Tomar foto del recibo'}
              </span>
              {!pending && (
                <span className="text-[9px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--brand-2)]/15 text-[var(--brand-text)]">
                  Rápido
                </span>
              )}
            </div>
            <div className="text-[12px] text-[var(--text2)] leading-snug">
              {pending
                ? 'Un momento, cargando tu foto…'
                : 'Apunta al recibo y registra el gasto en segundos.'}
            </div>
          </div>
        </button>
      )}

      {error && (
        <p className="text-[11px] text-[var(--coral-text)] mt-2 leading-relaxed">
          {error}
        </p>
      )}

      {usage && !url && (
        <p className="text-[10px] text-[var(--muted2)] mt-1.5 num tabular-nums">
          Lectura automática: {Math.max(0, usage.limit - usage.used)} de{' '}
          {usage.limit} escaneos restantes este mes
        </p>
      )}
    </div>
  )
}
