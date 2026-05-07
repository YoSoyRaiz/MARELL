'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Apple, Smartphone, Share, Plus, X, Check } from 'lucide-react'
import { InteractiveCard } from './InteractiveCard'

// Chrome/Edge fire `beforeinstallprompt` so we can offer an in-page
// install button. Safari (iOS) doesn't — the user has to use the
// share-sheet manually. We detect both and render the right path.

type BipEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  // iOS includes iPad in Desktop Mode, which reports MacIntel + maxTouchPoints>1.
  const isIPadOS =
    navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)
  if (/iphone|ipod|ipad/.test(ua) || isIPadOS) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari exposes a non-standard property.
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function LandingDownload() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [installed, setInstalled] = useState(false)
  const [bipEvent, setBipEvent] = useState<BipEvent | null>(null)
  const [iosOpen, setIosOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setInstalled(isAlreadyInstalled())
    const handler = (e: Event) => {
      e.preventDefault()
      setBipEvent(e as BipEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    const installedHandler = () => setInstalled(true)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleAndroidInstall = async () => {
    if (!bipEvent) {
      // Chrome hasn't fired the event yet (user needs to interact a
      // bit more or the manifest fails). Fall back to a tooltip.
      window.alert(
        'Tu navegador todavía no permite instalar. Asegúrate de estar usando Chrome y vuelve a intentarlo.',
      )
      return
    }
    setInstalling(true)
    try {
      await bipEvent.prompt()
      const choice = await bipEvent.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
      }
    } finally {
      setInstalling(false)
      setBipEvent(null)
    }
  }

  return (
    <section
      id="descargar"
      className="relative px-6 py-20 lg:py-24 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-text)]">
            Llévatela contigo
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Instala MARELL en tu{' '}
            <span className="gradient-text">teléfono</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--text2)]">
            Sin descargar nada de las stores. Una app nativa en tu pantalla
            de inicio que abre instantáneo y funciona en pantalla completa.
          </p>
        </div>

        {installed ? (
          <InstalledState />
        ) : (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {/* iOS card */}
            <InstallCard
              tone="iphone"
              icon={<Apple size={24} strokeWidth={2.2} />}
              label="iPhone"
              sublabel="iOS 16.4+"
              cta={
                platform === 'ios'
                  ? '👆 Esto es para ti — Cómo instalar'
                  : 'Ver instrucciones'
              }
              onClick={() => setIosOpen(true)}
              highlighted={platform === 'ios'}
            />
            {/* Android card */}
            <InstallCard
              tone="android"
              icon={<Smartphone size={24} strokeWidth={2.2} />}
              label="Android"
              sublabel="Chrome o Edge"
              cta={
                installing
                  ? 'Instalando…'
                  : platform === 'android'
                    ? '👆 Esto es para ti — Instalar'
                    : 'Instalar app'
              }
              onClick={handleAndroidInstall}
              highlighted={platform === 'android'}
              disabled={installing}
            />
          </div>
        )}

        <p className="mt-8 text-center text-[12px] text-[var(--muted)]">
          También funciona en desktop: instala desde Chrome / Edge clickeando
          el icono de instalar en la barra de direcciones.
        </p>
      </div>

      {iosOpen && <IosInstructions onClose={() => setIosOpen(false)} />}
    </section>
  )
}

function InstallCard({
  tone,
  icon,
  label,
  sublabel,
  cta,
  onClick,
  highlighted,
  disabled,
}: {
  tone: 'iphone' | 'android'
  icon: ReactNode
  label: string
  sublabel: string
  cta: string
  onClick: () => void
  highlighted: boolean
  disabled?: boolean
}) {
  const ringTone = highlighted
    ? 'border-[var(--brand-2)]/60 shadow-[0_0_0_4px_rgba(61,220,151,0.12)]'
    : 'border-white/[0.10]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group block text-left"
    >
      <InteractiveCard
        hue={tone === 'iphone' ? 'teal' : 'green'}
        surface={`rounded-2xl border ${ringTone} bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-colors disabled:opacity-50`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`size-14 rounded-xl flex items-center justify-center shrink-0 ${
              tone === 'iphone'
                ? 'bg-white/[0.06] text-white'
                : 'bg-[rgba(61,220,151,0.10)] text-[var(--brand-text)]'
            }`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold leading-tight">{label}</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">
              {sublabel}
            </div>
          </div>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold gradient-text">
          {cta}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>
      </InteractiveCard>
    </button>
  )
}

function InstalledState() {
  return (
    <div className="mt-12 mx-auto max-w-md rounded-2xl border border-[var(--brand-2)]/30 bg-[rgba(61,220,151,0.05)] p-6 text-center">
      <div className="mx-auto size-14 rounded-2xl bg-[rgba(61,220,151,0.12)] text-[var(--brand-text)] flex items-center justify-center mb-4">
        <Check size={24} strokeWidth={2.4} />
      </div>
      <p className="text-[16px] font-semibold text-[var(--text)]">
        Ya tienes MARELL instalada
      </p>
      <p className="text-[13px] text-[var(--text2)] mt-1 leading-relaxed">
        Búscala en tu pantalla de inicio. Tip: las notificaciones push están
        disponibles desde Ajustes.
      </p>
    </div>
  )
}

/**
 * Step-by-step modal for iOS users. The Web Share API on iOS Safari
 * has a built-in "Add to Home Screen" action and we point them right
 * at it. No screenshots — just clear copy with the system icons.
 */
function IosInstructions({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-step"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border2)] bg-[var(--s1)] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-step"
      >
        <header className="px-6 pt-5 pb-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] inline-flex items-center gap-2">
              <Apple size={12} strokeWidth={2.4} />
              iPhone / iPad
            </div>
            <h2
              id="ios-title"
              className="text-[20px] font-bold mt-1 leading-tight tracking-tight"
            >
              Instala MARELL en{' '}
              <span className="gradient-text">3 pasos</span>
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

        <ol className="px-6 py-5 space-y-5">
          <Step
            n={1}
            title="Abre marell.app en Safari"
            description="Tiene que ser Safari específicamente — Chrome en iPhone no soporta instalación de apps web."
          />
          <Step
            n={2}
            title="Toca el icono de Compartir"
            description="Es el cuadrado con la flecha hacia arriba, en la barra inferior."
            iconHint={<Share size={16} strokeWidth={2.2} />}
            iconLabel="Compartir"
          />
          <Step
            n={3}
            title='Selecciona "Añadir a pantalla de inicio"'
            description="Scroll en el menú de compartir hasta ver la opción con un ícono ⊕."
            iconHint={<Plus size={16} strokeWidth={2.2} />}
            iconLabel="Añadir a pantalla de inicio"
          />
        </ol>

        <div className="px-6 pb-5 pt-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-4 py-3 text-[12px] text-[var(--muted)] leading-relaxed">
            Tip: una vez instalada, el ícono de MARELL queda en tu pantalla de
            inicio como cualquier otra app. Abre instantáneo, sin Safari de por
            medio.
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  description,
  iconHint,
  iconLabel,
}: {
  n: number
  title: string
  description: string
  iconHint?: ReactNode
  iconLabel?: string
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="size-8 rounded-full bg-white/[0.04] border border-[var(--border)] text-[var(--text)] flex items-center justify-center shrink-0 text-[13px] font-bold">
        {n}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[14px] font-semibold text-[var(--text)] leading-snug">
          {title}
        </div>
        <p className="text-[12px] text-[var(--text2)] mt-1 leading-relaxed">
          {description}
        </p>
        {iconHint && (
          <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-[var(--border)]">
            <span className="text-[var(--brand-text)]">{iconHint}</span>
            <span className="text-[11px] text-[var(--text)]">{iconLabel}</span>
          </div>
        )}
      </div>
    </li>
  )
}
