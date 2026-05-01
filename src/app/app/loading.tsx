import { Logo } from '@/components/ui/Logo'

/**
 * Splash screen shown while the /app subtree streams server data on
 * first load (and on slow navigations between segments). Mirrors the
 * mobile mockup: centered logo + the brand tagline + a thin animated
 * progress bar at the bottom.
 *
 * Next.js renders this automatically as a Suspense boundary fallback;
 * we don't import it anywhere.
 */
export default function AppLoading() {
  return (
    <div className="fixed inset-0 z-40 bg-[var(--bg)] flex flex-col items-center justify-center px-8">
      <div className="flex flex-col items-center gap-4 mb-12">
        <Logo variant="icon" height={72} />
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-bold tracking-[0.2em] text-[var(--text)]">
            MARELL
          </span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-[14px] text-[var(--text)] font-medium">
          Tu dinero. Tu futuro.
        </p>
        <p className="text-[12px] text-[var(--muted)]">Bajo control.</p>
      </div>
      <div className="absolute bottom-16 inset-x-12 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full w-1/3 gradient-bg animate-[loading_1.4s_ease-in-out_infinite]" />
      </div>
      <style>
        {`@keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }`}
      </style>
    </div>
  )
}
