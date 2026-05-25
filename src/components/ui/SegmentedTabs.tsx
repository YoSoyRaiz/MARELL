import type { ReactNode } from 'react'

// SegmentedTabs: chips de filtro/período tipo pill.
//
// Antes 8 archivos duplicaban el mismo loop con el mismo className
// condicional `gradient-bg text-[#0B0B0C]` vs `bg-overlay-1 ...`. Cada
// uno con su propio botón inline. Si querías agregar disabled state o
// cambiar el rounded, había que tocar los 8.

interface SegmentedTabsOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedTabsProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: ReadonlyArray<SegmentedTabsOption<T>>
  ariaLabel?: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-2 flex-wrap ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`h-8 px-4 text-[12px] font-medium rounded-full transition-colors ${
              active
                ? 'gradient-bg text-[#0B0B0C]'
                : 'bg-[var(--overlay-1)] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--overlay-3)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
