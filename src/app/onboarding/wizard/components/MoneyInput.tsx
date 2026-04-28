'use client'

import { useState, useEffect, type ChangeEvent } from 'react'

interface MoneyInputProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  autoFocus?: boolean
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  ariaLabel,
  className = '',
  autoFocus,
}: MoneyInputProps) {
  // Local string state lets the user type partial numbers (e.g. "1," or ".") without the controlled input rejecting keystrokes.
  const [text, setText] = useState<string>(value === null ? '' : formatNumber(value))

  // If the parent value changes externally (e.g. reset / rehydrate), re-sync.
  useEffect(() => {
    const expected = value === null ? '' : formatNumber(value)
    setText((current) => {
      const currentNum = parseFloat(current.replace(/,/g, ''))
      const expectedNum = value
      if (
        (expectedNum === null && current === '') ||
        (expectedNum !== null && currentNum === expectedNum)
      ) {
        return current
      }
      return expected
    })
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    // Disallow more than one decimal point
    const parts = raw.split('.')
    const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw

    if (cleaned === '') {
      setText('')
      onChange(null)
      return
    }

    const [intPart, decPart] = cleaned.split('.')
    const intFmt = intPart === '' ? '' : Number(intPart).toLocaleString('en-US')
    const display = decPart !== undefined ? `${intFmt}.${decPart.slice(0, 2)}` : intFmt
    setText(display)

    const num = parseFloat(cleaned)
    onChange(isNaN(num) ? null : num)
  }

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[14px] pointer-events-none num">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="num !pl-8 !pr-3 !py-2.5 !text-[14px] !rounded-lg w-full text-right tabular-nums"
      />
    </div>
  )
}
