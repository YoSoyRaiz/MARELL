import type { ReactNode } from 'react'

// NativeSelect: <select> nativo con estilo + chevron.
//
// Antes 5 modales definían el mismo componente local con el SVG
// inline del chevron. Es importante que sea nativo (no custom UI)
// para que en mobile abra el picker del sistema.

interface NativeSelectProps {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  id?: string
  disabled?: boolean
  children: ReactNode
}

export function NativeSelect({
  value,
  onChange,
  ariaLabel,
  id,
  disabled,
  children,
}: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        disabled={disabled}
        className="w-full appearance-none !text-[14px] !py-3 !pl-4 !pr-10 !rounded-xl bg-[var(--s1)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <svg
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text2)]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
