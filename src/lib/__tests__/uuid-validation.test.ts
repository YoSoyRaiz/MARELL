import { describe, it, expect } from 'vitest'

// The PayPal webhook validates `custom_id` against this regex before
// using it to look up a profile. Locking the contract via tests so a
// future refactor can't loosen it accidentally.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('webhook UUID validation', () => {
  it('accepts a canonical lowercase UUID', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts uppercase variants', () => {
    expect(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('rejects free-form attacker payloads', () => {
    expect(UUID_RE.test('admin')).toBe(false)
    expect(UUID_RE.test("'; DROP TABLE profiles;--")).toBe(false)
    expect(UUID_RE.test('../../etc/passwd')).toBe(false)
    expect(UUID_RE.test('')).toBe(false)
  })

  it('rejects malformed UUID strings', () => {
    // Wrong segment lengths
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-4466554400000')).toBe(false)
    // Missing dashes
    expect(UUID_RE.test('550e8400e29b41d4a716446655440000')).toBe(false)
    // Trailing garbage
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000;')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(UUID_RE.test('zzze8400-e29b-41d4-a716-446655440000')).toBe(false)
  })
})
