'use client'

import { useState, useRef, useEffect } from 'react'

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Live thousands-separator formatting while the user types. Allows leading
// '+' so the user can express "add this amount on top of the current
// assignment" — e.g. typing "+1,000" on a category that already has $5,000
// will save $6,000.
function formatTyping(raw: string): string {
  let prefix = ''
  let s = raw.trim()
  if (s.startsWith('+')) {
    prefix = '+'
    s = s.slice(1)
  }
  // Strip everything except digits + a single dot.
  const cleaned = s.replace(/[^0-9.]/g, '')
  if (cleaned === '') return prefix
  const [intPart, ...rest] = cleaned.split('.')
  const decimals = rest.length > 0 ? `.${rest.join('').slice(0, 2)}` : ''
  const intFormatted = intPart === ''
    ? ''
    : Number(intPart).toLocaleString('en-US')
  return `${prefix}${intFormatted}${decimals}`
}

interface InlineMoneyEditProps {
  value: number
  onSave: (next: number) => Promise<void>
  ariaLabel?: string
}

export function InlineMoneyEdit({ value, onSave, ariaLabel }: InlineMoneyEditProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      const t = window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
      return () => window.cancelAnimationFrame(t)
    }
  }, [editing])

  const startEdit = () => {
    setText(value === 0 ? '' : formatTyping(value.toString()))
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setText('')
  }

  const commit = async () => {
    const trimmed = text.trim()
    const isAdd = trimmed.startsWith('+')
    const cleaned = trimmed.replace(/[^0-9.]/g, '')
    const num = cleaned === '' ? 0 : parseFloat(cleaned)
    if (!Number.isFinite(num) || num < 0) {
      cancel()
      return
    }
    const next = isAdd ? value + num : num
    if (Math.abs(next - value) < 0.005) {
      cancel()
      return
    }
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
      setEditing(false)
      setText('')
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        aria-label={ariaLabel ?? 'Editar monto asignado'}
        className="w-full text-right text-[14px] tabular-nums num text-[var(--text)] hover:text-[var(--brand-2)] py-1.5 px-2 -my-1.5 -mx-2 rounded-md hover:bg-white/[0.04] transition-colors"
      >
        {fmt(value)}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => setText(formatTyping(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
      disabled={saving}
      placeholder="0 o +500 para sumar"
      title="Escribe un monto total. Empieza con + para sumar al actual (ej: +1000)."
      className={`num !w-full !text-right !text-[14px] tabular-nums !py-1.5 !px-2 !rounded-md transition-opacity ${
        saving ? 'opacity-60' : ''
      }`}
    />
  )
}
