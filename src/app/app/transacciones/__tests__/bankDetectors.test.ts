import { describe, it, expect } from 'vitest'
import { detectBank } from '../bankDetectors'

describe('detectBank', () => {
  it('returns unknown for empty input', () => {
    const r = detectBank('')
    expect(r.bank).toBe('unknown')
    expect(r.confidence).toBe(0)
  })

  it('detects Banco Popular from a header mentioning the bank', () => {
    const csv =
      'Banco Popular Dominicano - Estado de cuenta\nFecha,Concepto,Cargo,Abono\n01/05/2026,Pago Edesur,1500,'
    const r = detectBank(csv)
    expect(r.bank).toBe('popular')
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it('detects Banreservas via the routing prefix in metadata', () => {
    const csv =
      'BANCO DE RESERVAS DE LA REPÚBLICA DOMINICANA\nFecha,Concepto,Débito,Crédito\n01/05/2026,Sueldo,,50000'
    const r = detectBank(csv)
    expect(r.bank).toBe('banreservas')
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it('detects BHD from the BHD León brand string', () => {
    const csv =
      'BHD León\nFecha,Detalle,Cargo,Abono,Balance\n01/05/2026,Pago Claro,800,,'
    const r = detectBank(csv)
    expect(r.bank).toBe('bhd')
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it('detects Scotia from the brand string', () => {
    const csv =
      'Scotiabank\nTrans Date,Description,Withdrawals,Deposits\n2026-05-01,Walmart,1500,'
    const r = detectBank(csv)
    expect(r.bank).toBe('scotia')
    expect(r.confidence).toBeGreaterThan(0.5)
  })

  it('returns unknown for a generic CSV with no bank markers', () => {
    const csv =
      'date,payee,amount\n2026-05-01,Coffee shop,-150\n2026-05-02,Salary,50000'
    const r = detectBank(csv)
    expect(r.bank).toBe('unknown')
  })

  it('produces a column map with date and payee indices when the bank matches', () => {
    const csv =
      'Banco Popular\nFecha,Concepto,Cargo,Abono\n01/05/2026,Pago,500,'
    const r = detectBank(csv)
    expect(r.bank).toBe('popular')
    expect(r.columnMap?.date).toBeGreaterThanOrEqual(0)
    expect(r.columnMap?.payee).toBeGreaterThanOrEqual(0)
  })
})
