'use client'

import { useRef, useState } from 'react'
import { Camera, X, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ReceiptCaptureProps {
  /** Existing receipt URL (when editing). */
  initialUrl?: string | null
  /** Existing path inside the bucket (when editing) — used to remove
   *  the previous file on replace/clear. */
  initialPath?: string | null
  /** Fires whenever the receipt changes. Called with `{ url, path }`
   *  on upload/replace and with `null` on remove. */
  onChange: (next: { url: string; path: string } | null) => void
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
}: ReceiptCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [path, setPath] = useState<string | null>(initialPath ?? null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <div className="relative rounded-xl overflow-hidden border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Recibo adjunto"
            className="w-full max-h-64 object-cover"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="w-9 h-9 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Reemplazar foto"
            >
              <Camera size={14} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="w-9 h-9 rounded-lg bg-black/60 backdrop-blur-sm text-[var(--coral)] hover:bg-black/80 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="Quitar foto"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="w-full rounded-xl border border-dashed border-[var(--border2)] bg-[var(--bg)]/40 hover:bg-white/[0.02] hover:border-[var(--brand-2)]/40 px-4 py-4 flex items-center gap-3 transition-colors disabled:opacity-60"
        >
          <div className="w-10 h-10 rounded-lg bg-[rgba(61,220,151,0.10)] text-[var(--brand-2)] flex items-center justify-center shrink-0">
            {pending ? (
              <span className="inline-block w-4 h-4 rounded-full border-2 border-[var(--brand-2)]/30 border-t-[var(--brand-2)] animate-spin" />
            ) : (
              <Camera size={16} strokeWidth={2.2} />
            )}
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text)]">
              {pending ? 'Subiendo…' : 'Foto del recibo'}
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              <span className="inline-flex items-center gap-1">
                <ImageIcon size={10} strokeWidth={2.2} />
                Opcional · máx 5 MB
              </span>
            </div>
          </div>
        </button>
      )}

      {error && (
        <p className="text-[11px] text-[var(--coral)] mt-2 leading-relaxed">
          {error}
        </p>
      )}
    </div>
  )
}
