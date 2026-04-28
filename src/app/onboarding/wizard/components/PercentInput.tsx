'use client'

import { useState, useEffect, type ChangeEvent } from 'react'

interface PercentInputProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  ariaLabel?: string
}

export function PercentInput({ value, onChange, placeholder = '0', ariaLabel }: PercentInputProps) {
  const [text, setText] = useState<string>(value === null ? '' : String(value))

  useEffect(() => {
    setText((current) => {
      const currentNum = parseFloat(current)
      if ((value === null && current === '') || currentNum === value) return current
      return value === null ? '' : String(value)
    })
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw

    setText(cleaned)
    if (cleaned === '') {
      onChange(null)
      return
    }
    const num = parseFloat(cleaned)
    onChange(isNaN(num) ? null : num)
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="num !pr-9 !pl-4 !py-3.5 !text-[16px] !rounded-xl w-full tabular-nums"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[14px] pointer-events-none num">
        %
      </span>
    </div>
  )
}
