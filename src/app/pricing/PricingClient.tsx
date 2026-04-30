'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  X,
  Copy,
  Check,
  Mail,
  Building2,
  Sparkles,
} from 'lucide-react'
import {
  PAYMENT_ACCOUNTS,
  PAYMENT_SUPPORT_EMAIL,
  PRO_PRICE_MONTH_DOP,
  PRO_PRICE_YEAR_DOP,
  paymentReference,
} from '@/lib/payment'

const fmt = (n: number) =>
  `RD$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

type Cycle = 'month' | 'year'

interface Props {
  userId: string | null
  userEmail: string | null
}

export function PricingClient({ userId, userEmail }: Props) {
  const [open, setOpen] = useState(false)

  if (!userId) {
    return (
      <Link
        href="/signup"
        className="mt-8 h-11 gradient-bg text-[#0B0B0C] font-semibold text-[14px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center justify-center gap-2 transition-[filter]"
      >
        Empieza gratis
        <ArrowRight size={14} strokeWidth={2.4} />
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 h-11 gradient-bg text-[#0B0B0C] font-semibold text-[14px] rounded-xl glow-on-hover hover:brightness-105 active:brightness-95 inline-flex items-center justify-center gap-2 transition-[filter]"
      >
        Pasar a Pro
        <ArrowRight size={14} strokeWidth={2.4} />
      </button>

      {open && (
        <PaymentDialog
          userId={userId}
          userEmail={userEmail}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function PaymentDialog({
  userId,
  userEmail,
  onClose,
}: {
  userId: string
  userEmail: string | null
  onClose: () => void
}) {
  const [cycle, setCycle] = useState<Cycle>('month')
  const reference = paymentReference(userId)
  const amount = cycle === 'year' ? PRO_PRICE_YEAR_DOP : PRO_PRICE_MONTH_DOP

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const subject = `Pago MARELL Pro · ${reference}`
  const body = [
    'Hola,',
    '',
    `Acabo de transferir ${fmt(amount)} para activar Pro ${cycle === 'year' ? '(plan anual)' : '(plan mensual)'}.`,
    '',
    `Código de referencia: ${reference}`,
    `Email de la cuenta: ${userEmail ?? '(añadir)'}`,
    '',
    'Adjunto el comprobante.',
  ].join('\n')

  const mailto = `mailto:${PAYMENT_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

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
        aria-labelledby="pay-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4 sticky top-0 bg-[var(--s1)] z-10">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-2)]">
              Pago por transferencia
            </div>
            <h2 id="pay-title" className="text-[20px] font-bold mt-1 leading-tight tracking-tight">
              Activa <span className="gradient-text">MARELL Pro</span>
            </h2>
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

        <div className="px-6 py-5 space-y-5">
          {/* Cycle toggle */}
          <div>
            <label className="text-[12px] text-[var(--text2)] font-medium mb-1.5 block">
              Plan
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg)] rounded-xl">
              <button
                type="button"
                onClick={() => setCycle('month')}
                className={`py-3 rounded-lg text-[13px] font-semibold transition-all ${
                  cycle === 'month'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Mensual · {fmt(PRO_PRICE_MONTH_DOP)}
              </button>
              <button
                type="button"
                onClick={() => setCycle('year')}
                className={`py-3 rounded-lg text-[13px] font-semibold transition-all ${
                  cycle === 'year'
                    ? 'gradient-bg text-[#0B0B0C]'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                Anual · {fmt(PRO_PRICE_YEAR_DOP)}
              </button>
            </div>
          </div>

          {/* Step 1 — Reference */}
          <Step
            n={1}
            title="Copia tu código de referencia"
            subtitle="Inclúyelo en el concepto de la transferencia para que podamos identificar tu pago."
          >
            <CopyRow value={reference} mono large />
          </Step>

          {/* Step 2 — Bank info */}
          <Step
            n={2}
            title="Transfiere a una de estas cuentas"
            subtitle={`Monto: ${fmt(amount)}. Cualquiera de estos bancos sirve — usa el que tengas para evitar comisiones.`}
          >
            <div className="space-y-3">
              {PAYMENT_ACCOUNTS.map((acc) => (
                <div
                  key={acc.bank + acc.number}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={14} strokeWidth={2.2} className="text-[var(--brand-2)]" />
                    <span className="text-[13px] font-semibold">{acc.bank}</span>
                  </div>
                  <Row label="Beneficiario" value={acc.holder} />
                  <Row label="Tipo" value={acc.type} />
                  <Row label="Número de cuenta" value={acc.number} mono copy />
                </div>
              ))}
            </div>
          </Step>

          {/* Step 3 — Send proof */}
          <Step
            n={3}
            title="Envíanos el comprobante"
            subtitle="Te activamos Pro dentro de 24 horas."
          >
            <a
              href={mailto}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[var(--text)] text-[13px] font-medium transition-colors"
            >
              <Mail size={14} strokeWidth={2.2} />
              Abrir correo a {PAYMENT_SUPPORT_EMAIL}
            </a>
          </Step>

          <div className="rounded-xl border border-[var(--success)]/30 bg-[rgba(61,220,151,0.05)] p-4 flex gap-3">
            <Sparkles size={16} strokeWidth={2.2} className="text-[var(--brand-2)] shrink-0 mt-0.5" />
            <div className="text-[13px] leading-relaxed text-[var(--text)]">
              <strong className="font-semibold">Mientras tanto:</strong> tu trial
              sigue activo. Podemos extenderlo mientras procesamos el pago — solo
              avísanos al correo.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  subtitle,
  children,
}: {
  n: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="grid size-6 place-items-center rounded-full bg-[var(--success)]/[0.15] text-[var(--success)] text-[12px] font-bold shrink-0 mt-0.5">
          {n}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-tight">{title}</p>
          <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="ml-9">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  copy,
}: {
  label: string
  value: string
  mono?: boolean
  copy?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--muted)]">
        {label}
      </span>
      {copy ? (
        <CopyRow value={value} mono={mono} small />
      ) : (
        <span className={`text-[13px] ${mono ? 'num tabular-nums' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function CopyRow({
  value,
  mono,
  large,
  small,
}: {
  value: string
  mono?: boolean
  large?: boolean
  small?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback: select + manual copy hint — silently noop is fine for MVP
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 hover:border-[var(--border3)] hover:bg-[var(--bg)] transition-colors ${
        large ? 'h-11 text-[14px] w-full justify-between' : 'h-8 text-[12px]'
      } ${mono ? 'num tabular-nums' : ''}`}
      aria-label={`Copiar ${value}`}
    >
      <span className={`truncate ${small ? 'font-medium' : 'font-semibold'}`}>
        {value}
      </span>
      <span className="shrink-0 text-[var(--muted)] inline-flex items-center gap-1">
        {copied ? (
          <>
            <Check size={12} strokeWidth={2.4} className="text-[var(--brand-2)]" />
            <span className="text-[11px] text-[var(--brand-2)] font-semibold">
              Copiado
            </span>
          </>
        ) : (
          <Copy size={12} strokeWidth={2.2} />
        )}
      </span>
    </button>
  )
}
