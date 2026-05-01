import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatMoneyShort,
  parseCurrency,
  convertAmount,
} from '../money'

describe('formatMoney', () => {
  it('formats DOP with RD$ prefix and 2 decimals', () => {
    expect(formatMoney(1234.5, 'DOP')).toBe('RD$1,234.50')
    expect(formatMoney(0, 'DOP')).toBe('RD$0.00')
    expect(formatMoney(999, 'DOP')).toBe('RD$999.00')
  })

  it('formats USD with $ prefix', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('renders negatives with the unicode minus', () => {
    expect(formatMoney(-100, 'DOP')).toBe('−RD$100.00')
    expect(formatMoney(-0.5, 'USD')).toBe('−$0.50')
  })

  it('treats values within 0.005 of zero as zero (no negative sign)', () => {
    expect(formatMoney(-0.001, 'DOP')).toBe('RD$0.00')
    expect(formatMoney(0.001, 'DOP')).toBe('RD$0.00')
  })
})

describe('formatMoneyShort', () => {
  it('drops decimals', () => {
    expect(formatMoneyShort(1234.5, 'DOP')).toBe('RD$1,235')
    expect(formatMoneyShort(0, 'DOP')).toBe('RD$0')
  })
})

describe('parseCurrency', () => {
  it('returns USD when input is "USD"', () => {
    expect(parseCurrency('USD')).toBe('USD')
  })

  it('falls back to DOP for anything else', () => {
    expect(parseCurrency('DOP')).toBe('DOP')
    expect(parseCurrency('EUR')).toBe('DOP')
    expect(parseCurrency(null)).toBe('DOP')
    expect(parseCurrency(undefined)).toBe('DOP')
    expect(parseCurrency('')).toBe('DOP')
  })
})

describe('convertAmount', () => {
  it('passes through identity conversions', () => {
    expect(convertAmount(100, 'DOP', 'DOP', 60)).toBe(100)
    expect(convertAmount(50, 'USD', 'USD', 60)).toBe(50)
  })

  it('multiplies USD → DOP by the rate', () => {
    expect(convertAmount(10, 'USD', 'DOP', 60)).toBe(600)
    expect(convertAmount(1.5, 'USD', 'DOP', 60.5)).toBeCloseTo(90.75, 2)
  })

  it('divides DOP → USD by the rate', () => {
    expect(convertAmount(600, 'DOP', 'USD', 60)).toBe(10)
    expect(convertAmount(120, 'DOP', 'USD', 60)).toBe(2)
  })

  it('returns the input untouched when the rate is invalid', () => {
    expect(convertAmount(100, 'USD', 'DOP', 0)).toBe(100)
    expect(convertAmount(100, 'USD', 'DOP', NaN)).toBe(100)
    expect(convertAmount(100, 'USD', 'DOP', -10)).toBe(100)
  })
})
