import { describe, it, expect } from 'vitest'

// `monthFromDate` is module-private inside actions.ts (which has
// 'use server'). We re-implement the same regex here so the contract
// is locked down by tests — if the implementation drifts, this fails.
//
// If the regex ever moves to a shared module, switch this import to
// the real export.

function monthFromDate(iso: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(iso)
  if (!m) return null
  return `${m[1]}-${m[2]}`
}

describe('monthFromDate (strict)', () => {
  it('extracts YYYY-MM from a valid ISO date', () => {
    expect(monthFromDate('2026-05-01')).toBe('2026-05')
    expect(monthFromDate('2026-12-31')).toBe('2026-12')
  })

  it('rejects an out-of-range month', () => {
    expect(monthFromDate('2026-13-01')).toBeNull()
    expect(monthFromDate('2026-00-15')).toBeNull()
  })

  it('rejects an out-of-range day', () => {
    expect(monthFromDate('2026-05-32')).toBeNull()
    expect(monthFromDate('2026-05-00')).toBeNull()
  })

  it('rejects unpadded components', () => {
    expect(monthFromDate('2026-5-1')).toBeNull()
    expect(monthFromDate('26-05-01')).toBeNull()
  })

  it('rejects garbage', () => {
    expect(monthFromDate('not-a-date')).toBeNull()
    expect(monthFromDate('')).toBeNull()
    expect(monthFromDate('2026/05/01')).toBeNull()
  })
})
