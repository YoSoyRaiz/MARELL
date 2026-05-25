// Spinner CSS-only. El patrón `inline-block w-X h-X rounded-full
// border-2 border-Y/30 border-t-Y animate-spin` vivía duplicado en
// 10+ botones de submit. Aquí los tonos comunes:
//
// - `dark` (default): para botones gradient (texto color #0B0B0C)
// - `light`: para botones danger/coral con texto blanco
// - `coral`: indicador inline standalone

type Size = 'sm' | 'md' | 'lg'
type Tone = 'dark' | 'light' | 'coral'

const sizeClasses: Record<Size, string> = {
  sm: 'w-3.5 h-3.5 border-2',
  md: 'w-4 h-4 border-2',
  lg: 'w-10 h-10 border-[3px]',
}

const toneClasses: Record<Tone, string> = {
  dark: 'border-[#0B0B0C]/30 border-t-[#0B0B0C]',
  light: 'border-white/20 border-t-white',
  coral: 'border-[var(--coral)]/30 border-t-[var(--coral)]',
}

interface SpinnerProps {
  size?: Size
  tone?: Tone
  className?: string
}

export function Spinner({
  size = 'sm',
  tone = 'dark',
  className = '',
}: SpinnerProps) {
  return (
    <span
      className={`inline-block rounded-full animate-spin ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
      aria-hidden
    />
  )
}
