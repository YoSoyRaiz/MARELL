import { describe, it, expect } from 'vitest'
import { parseCSV } from '../csv'

describe('parseCSV', () => {
  it('parses a simple comma-separated file with amount column', () => {
    const text = [
      'Date,Description,Amount',
      '2026-05-01,Coffee shop,-150.00',
      '2026-05-02,Salary,50000.00',
    ].join('\n')
    const r = parseCSV(text)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].date).toBe('2026-05-01')
    expect(r.rows[0].payeeName).toBe('Coffee shop')
    expect(r.rows[0].amount).toBe(-150)
    expect(r.rows[1].amount).toBe(50000)
  })

  it('handles débito/crédito split columns', () => {
    const text = [
      'Fecha;Concepto;Débito;Crédito',
      '01/05/2026;Pago Claro;800;',
      '02/05/2026;Sueldo;;50000',
    ].join('\n')
    const r = parseCSV(text)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].amount).toBe(-800)
    expect(r.rows[1].amount).toBe(50000)
  })

  it('parses DD/MM/YYYY date format (Latin convention)', () => {
    const text = ['Fecha,Descripcion,Monto', '15/03/2026,Test,100'].join('\n')
    const r = parseCSV(text)
    expect(r.rows[0].date).toBe('2026-03-15')
  })

  it('handles parenthesized amounts as negatives', () => {
    const text = ['Fecha,Concepto,Monto', '01/05/2026,Test,(150.00)'].join(
      '\n',
    )
    const r = parseCSV(text)
    expect(r.rows[0].amount).toBe(-150)
  })

  it('skips rows without a parseable date', () => {
    const text = [
      'Date,Description,Amount',
      'BLANK,Garbage row,100',
      '2026-05-01,Real txn,500',
    ].join('\n')
    const r = parseCSV(text)
    expect(r.rows).toHaveLength(1)
    expect(r.skippedRows).toBe(1)
  })

  it('returns an error warning when no Date column is found', () => {
    const text = ['Foo,Bar,Baz', '1,2,3'].join('\n')
    const r = parseCSV(text)
    expect(r.rows).toHaveLength(0)
    expect(r.warnings.join(' ')).toMatch(/fecha|date/i)
  })

  it('handles quoted values with embedded commas', () => {
    const text = [
      'Date,Description,Amount',
      '2026-05-01,"Acme, Inc.",-500',
    ].join('\n')
    const r = parseCSV(text)
    expect(r.rows[0].payeeName).toBe('Acme, Inc.')
    expect(r.rows[0].amount).toBe(-500)
  })
})
