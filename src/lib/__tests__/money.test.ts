import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatMoneyShort,
  parseCurrency,
  convertAmount,
  parseAmount,
  formatAmountWhileTyping,
  DEFAULT_USD_TO_DOP_RATE,
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

describe('parseAmount', () => {
  it('parses números simples', () => {
    expect(parseAmount('1234')).toBe(1234)
    expect(parseAmount('1234.56')).toBe(1234.56)
  })

  it('parses separador de miles (US: 1,234.56)', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1,234,567.89')).toBe(1234567.89)
  })

  it('parses formato europeo (1.234,56)', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
  })

  it('decide coma decimal vs miles según dígitos después', () => {
    expect(parseAmount('123,45')).toBe(123.45) // ≤2 dígitos = decimal
    expect(parseAmount('1,234')).toBe(1234) // >2 dígitos = miles
  })

  it('paréntesis = negativo (accounting style)', () => {
    expect(parseAmount('(100)')).toBe(-100)
    expect(parseAmount('(1,234.56)')).toBe(-1234.56)
  })

  it('quita símbolos de moneda', () => {
    expect(parseAmount('$100')).toBe(100)
    expect(parseAmount('€100.50')).toBe(100.5)
  })

  it('retorna null para strings inválidas', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-')).toBeNull()
  })
})

describe('formatAmountWhileTyping', () => {
  it('agrega separadores de miles', () => {
    expect(formatAmountWhileTyping('1234')).toBe('1,234')
    expect(formatAmountWhileTyping('1234567')).toBe('1,234,567')
  })

  it('preserva decimal con hasta 2 dígitos', () => {
    expect(formatAmountWhileTyping('1234.5')).toBe('1,234.5')
    expect(formatAmountWhileTyping('1234.56')).toBe('1,234.56')
    expect(formatAmountWhileTyping('1234.567')).toBe('1,234.56')
  })

  it('preserva el punto sin decimales escritos', () => {
    expect(formatAmountWhileTyping('1234.')).toBe('1,234.')
  })

  it('string vacío preserva vacío', () => {
    expect(formatAmountWhileTyping('')).toBe('')
  })

  it('limpia caracteres no numéricos', () => {
    expect(formatAmountWhileTyping('1a2b3c')).toBe('123')
  })
})

describe('DEFAULT_USD_TO_DOP_RATE', () => {
  it('está en rango razonable', () => {
    expect(DEFAULT_USD_TO_DOP_RATE).toBeGreaterThan(30)
    expect(DEFAULT_USD_TO_DOP_RATE).toBeLessThan(200)
  })
})
