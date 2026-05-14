'use client'

import type { ReactNode } from 'react'

interface SelectCardProps {
  active: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  description?: string
  multi?: boolean
}

export function SelectCard({ active, onClick, icon, title, description, multi }: SelectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
        active
          ? 'border-[var(--brand-2)] bg-[rgba(61,220,151,0.06)] shadow-[0_0_0_4px_rgba(61,220,151,0.10)]'
          : 'border-[var(--border)] bg-[var(--s1)] hover:border-[var(--border3)] hover:-translate-y-[1px]'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all ${
          active
            ? 'bg-[rgba(61,220,151,0.14)] text-[var(--brand-2)]'
            : 'bg-[var(--overlay-2)] text-[var(--text2)]'
        }`}
      >
        {icon}
      </div>
      <div className="font-semibold text-[15px] text-[var(--text)] mb-1 pr-7">{title}</div>
      {description && (
        <div className="text-[13px] text-[var(--text2)] leading-snug">{description}</div>
      )}
      {multi && (
        <div
          className={`absolute top-4 right-4 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
            active ? 'border-[var(--brand-2)] bg-[var(--brand-2)]' : 'border-[var(--border3)]'
          }`}
        >
          {active && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.5L4.5 8.5L9.5 3.5"
                stroke="#0B0B0C"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}
    </button>
  )
}
