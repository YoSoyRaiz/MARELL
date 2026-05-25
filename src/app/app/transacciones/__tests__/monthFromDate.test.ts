import { describe, it, expect } from 'vitest'
import { monthFromDate } from '@/lib/dates'

// monthFromDate vivía privadamente dentro de actions.ts. Se movió a
// lib/dates.ts como helper puro (auditoría calidad M8) y este test
// ahora importa la versión real.

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
