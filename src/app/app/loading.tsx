import { Logo } from '@/components/ui/Logo'

/**
 * Splash screen shown while the /app subtree streams server data on
 * first load (and on slow navigations between segments). Centered
 * logo + tagline + three subtle pulsing dots — no full-width gradient
 * bar that could stack visually with hot-reload indicators or extend
 * past the viewport on small screens.
 *
 * Next.js renders this automatically as a Suspense boundary fallback;
 * we don't import it anywhere.
 */
export default function AppLoading() {
  return (
    <div className="fixed inset-0 z-40 bg-[var(--bg)] flex flex-col items-center justify-center px-8">
      <div className="flex flex-col items-center gap-4">
        <Logo variant="icon" height={72} />
        <span className="text-h2 font-bold tracking-[0.2em] text-[var(--text)]">
          MARELL
        </span>
      </div>
      <div className="text-center space-y-1 mt-6">
        <p className="text-body text-[var(--text)] font-medium">
          Tu dinero. Tu futuro.
        </p>
        <p className="text-meta text-[var(--muted)]">Bajo control.</p>
      </div>
      <div className="mt-10 flex items-center gap-2" aria-label="Cargando">
        <span className="w-2 h-2 rounded-full gradient-bg animate-[marellDot_1.2s_ease-in-out_infinite] [animation-delay:0s]" />
        <span className="w-2 h-2 rounded-full gradient-bg animate-[marellDot_1.2s_ease-in-out_infinite] [animation-delay:0.2s]" />
        <span className="w-2 h-2 rounded-full gradient-bg animate-[marellDot_1.2s_ease-in-out_infinite] [animation-delay:0.4s]" />
      </div>
      <style>
        {`@keyframes marellDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }`}
      </style>
    </div>
  )
}
