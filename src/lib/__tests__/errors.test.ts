import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { safeError, sanitizeSupabaseError } from '../errors'

describe('safeError', () => {
  let originalEnv: string | undefined
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete (process.env as { NODE_ENV?: string }).NODE_ENV
    } else {
      ;(process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv
    }
    consoleSpy.mockRestore()
  })

  it('returns a generic message in production for unknown errors', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'production'
    const r = safeError(new Error('select * from secret_table failed: column "ssn" does not exist'))
    expect(r).toBe('Algo salió mal. Intenta de nuevo.')
    expect(r).not.toContain('secret_table')
    expect(r).not.toContain('ssn')
  })

  it('includes original message in development for debuggability', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'development'
    const r = safeError(new Error('boom'))
    expect(r).toContain('boom')
  })

  it('maps known Postgres patterns to friendly copy', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'production'
    expect(safeError(new Error('duplicate key value violates unique constraint'))).toBe(
      'Ese valor ya existe.',
    )
    expect(safeError(new Error('row violates row-level security policy'))).toBe(
      'No tienes permiso para hacer eso.',
    )
  })

  it('logs the original error so developers can investigate', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'production'
    safeError(new Error('actual cause'), 'createTransaction')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('actual cause'),
    )
  })

  it('handles non-Error inputs gracefully', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'production'
    expect(safeError('string error')).toBe('Algo salió mal. Intenta de nuevo.')
    expect(safeError(null)).toBe('Algo salió mal. Intenta de nuevo.')
    expect(safeError(undefined)).toBe('Algo salió mal. Intenta de nuevo.')
    expect(safeError({ message: 'object with msg' })).toBe(
      'Algo salió mal. Intenta de nuevo.',
    )
  })
})

describe('sanitizeSupabaseError', () => {
  it('returns null for null input', () => {
    expect(sanitizeSupabaseError(null)).toBeNull()
    expect(sanitizeSupabaseError(undefined)).toBeNull()
  })

  it('sanitizes a Supabase-shaped error in production', () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = 'production'
    expect(
      sanitizeSupabaseError({ message: 'duplicate key violates unique constraint' }),
    ).toBe('Ese valor ya existe.')
  })
})
