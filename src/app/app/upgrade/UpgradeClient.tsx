'use client'

import { useState, useTransition } from 'react'
import { Check, AlertCircle, CreditCard, Sparkles } from 'lucide-react'
import { startAzulCheckout, startPaypalCheckout, cancelSubscription } from './actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useRouter } from 'next/navigation'
import { MARELL_PRO_DOP } from '@/lib/billing/types'

interface SubscriptionSummary {
  provider: 'azul' | 'paypal' | null
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | null
  nextBillingAt: string | null
  cardLast4: string | null
  cardBrand: string | null
}

interface UpgradeClientProps {
  canceled: boolean
  plan: string
  trialEndsAt: string | null
  proExpiresAt: string | null
  subscription: SubscriptionSummary
}

const formatDate = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function UpgradeClient({
  canceled,
  plan,
  trialEndsAt,
  proExpiresAt,
  subscription,
}: UpgradeClientProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<'azul' | 'paypal' | null>(null)

  const isPro = plan === 'pro' && subscription.status === 'active'
  const isTrial = plan === 'trial'
  const trialEnd = formatDate(trialEndsAt)
  const proEnd = formatDate(proExpiresAt)
  const nextBilling = formatDate(subscription.nextBillingAt)

  const handleStart = (provider: 'azul' | 'paypal') => {
    setError(null)
    setPendingProvider(provider)
    startTransition(async () => {
      const fn = provider === 'azul' ? startAzulCheckout : startPaypalCheckout
      const r = await fn()
      setPendingProvider(null)
      if ('error' in r) {
        setError(r.error)
        return
      }
      window.location.href = r.redirectUrl
    })
  }

  const handleCancel = async () => {
    const ok = await confirm({
      title: '¿Cancelar tu suscripción Pro?',
      description: `Mantienes acceso hasta ${proEnd ?? 'el final del periodo actual'}. Después de eso pasas al plan gratis con funciones limitadas.`,
      confirmLabel: 'Sí, cancelar',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const r = await cancelSubscription()
      if (r && 'error' in r && r.error) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-7 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Plan
        </div>
        <h1 className="text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-bold tracking-tight">
          {isPro ? (
            <>
              Estás en <span className="gradient-text">Pro</span>.
            </>
          ) : isTrial ? (
            <>
              Pasa a <span className="gradient-text">Pro</span> antes de que termine tu prueba.
            </>
          ) : (
            <>
              Activa <span className="gradient-text">Pro</span> y libera todo MARELL.
            </>
          )}
        </h1>
        {isTrial && trialEnd && (
          <p className="text-[14px] text-[var(--text2)] leading-relaxed">
            Tu prueba gratuita termina el {trialEnd}. Sin compromiso, cancela cuando quieras.
          </p>
        )}
        {!isPro && !isTrial && (
          <p className="text-[14px] text-[var(--text2)] leading-relaxed">
            Activa Pro para recuperar acceso a metas, programadas, reportes y más.
          </p>
        )}
      </div>

      {canceled && (
        <div className="rounded-xl border border-[var(--warn)]/40 bg-[rgba(245,200,66,0.06)] px-4 py-3 flex items-start gap-3 text-[13px]">
          <AlertCircle
            size={16}
            strokeWidth={2.2}
            className="text-[var(--warn-text)] shrink-0 mt-0.5"
          />
          <span>Cancelaste el proceso. Puedes intentarlo de nuevo cuando quieras.</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.06)] px-4 py-3 flex items-start gap-3 text-[13px]">
          <AlertCircle
            size={16}
            strokeWidth={2.2}
            className="text-[var(--coral-text)] shrink-0 mt-0.5"
          />
          <span>{error}</span>
        </div>
      )}

      {/* Already-subscribed view */}
      {isPro ? (
        <section className="rounded-2xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.04)] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg text-[#0B0B0C] flex items-center justify-center shrink-0">
              <Sparkles size={18} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[var(--text)]">
                Pro activo
              </div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">
                {subscription.provider === 'azul'
                  ? subscription.cardLast4
                    ? `Tarjeta ${subscription.cardBrand ?? ''} •••• ${subscription.cardLast4} (Azul)`
                    : 'Pagando con Azul'
                  : subscription.provider === 'paypal'
                    ? 'Pagando con PayPal'
                    : ''}
              </div>
              {nextBilling && (
                <div className="text-[12px] text-[var(--muted)] mt-1 num tabular-nums">
                  Próximo cobro: {nextBilling}
                </div>
              )}
            </div>
          </div>
          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--text2)]">
              Cancela cuando quieras. Mantienes acceso hasta el fin del ciclo.
            </p>
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="text-[12px] font-medium text-[var(--coral-text)] hover:underline underline-offset-4 disabled:opacity-50"
            >
              Cancelar suscripción
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Plan card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--s1)] p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)]">
                  MARELL Pro
                </div>
                <div className="mt-2 inline-flex items-baseline gap-2">
                  <span className="text-[44px] font-bold tabular-nums num gradient-text leading-none">
                    RD${MARELL_PRO_DOP.pricePerMonth.toLocaleString('en-US')}
                  </span>
                  <span className="text-[14px] text-[var(--muted)]">/mes</span>
                </div>
                <p className="text-[12px] text-[var(--muted)] mt-1">
                  Cancela cuando quieras. Sin permanencia.
                </p>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MARELL_PRO_DOP.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[13px] text-[var(--text)]"
                >
                  <Check
                    size={14}
                    strokeWidth={2.4}
                    className="text-[var(--brand-text)] shrink-0 mt-0.5"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t border-[var(--border)] space-y-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] font-semibold">
                Elige cómo pagar
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStart('azul')}
                  disabled={pending}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-4 py-3.5 text-left flex items-start gap-3 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="w-10 h-10 rounded-lg bg-[rgba(77,168,255,0.10)] text-[var(--info-text)] flex items-center justify-center shrink-0">
                    <CreditCard size={18} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">
                      Tarjeta vía Azul
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                      {pendingProvider === 'azul'
                        ? 'Redirigiendo…'
                        : 'Visa, Mastercard, AmEx. Cobro mensual automático en RD$.'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleStart('paypal')}
                  disabled={pending}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand-2)]/40 hover:bg-[var(--overlay-1)] px-4 py-3.5 text-left flex items-start gap-3 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="w-10 h-10 rounded-lg bg-[rgba(245,200,66,0.10)] text-[var(--warn-text)] flex items-center justify-center shrink-0">
                    <span className="font-bold text-[13px]">PP</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">
                      PayPal
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                      {pendingProvider === 'paypal'
                        ? 'Redirigiendo…'
                        : 'Cobro mensual en USD. Para usuarios fuera de RD o que prefieran PayPal.'}
                    </div>
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-[var(--muted2)] leading-relaxed">
                Tus datos de tarjeta nunca pasan por MARELL. Azul y PayPal manejan el cobro y solo nos avisan cuando completaste el pago.
              </p>
            </div>
          </section>

          {/* Past-due banner */}
          {subscription.status === 'past_due' && (
            <section className="rounded-2xl border border-[var(--coral)]/40 bg-[rgba(255,122,89,0.04)] p-5 flex items-start gap-3">
              <AlertCircle
                size={18}
                strokeWidth={2.2}
                className="text-[var(--coral-text)] shrink-0 mt-0.5"
              />
              <div className="text-[13px]">
                <div className="font-semibold text-[var(--text)]">
                  El último pago falló.
                </div>
                <p className="text-[var(--text2)] mt-1 leading-relaxed">
                  Vuelve a iniciar el flujo arriba para actualizar tu método de pago. Tu acceso queda activo hasta {proEnd ?? 'el final del ciclo actual'}.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
