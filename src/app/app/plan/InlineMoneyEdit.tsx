'use client'

import { useState, useRef, useEffect } from 'react'

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
    setText(value === 0 ? '' : value.toString())
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setText('')
  }

  const commit = async () => {
    const cleaned = text.replace(/[^0-9.]/g, '')
    const num = cleaned === '' ? 0 : parseFloat(cleaned)
    if (!Number.isFinite(num) || num < 0) {
      cancel()
      return
    }
    if (Math.abs(num - value) < 0.005) {
      cancel()
      return
    }
    setSaving(true)
    try {
      await onSave(num)
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
      onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
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
      placeholder="0"
      className={`num !w-full !text-right !text-[14px] tabular-nums !py-1.5 !px-2 !rounded-md transition-opacity ${
        saving ? 'opacity-60' : ''
      }`}
    />
  )
}
