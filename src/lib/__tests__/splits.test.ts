import { describe, expect, it } from 'vitest'
import {
  expandToCategoryContributions,
  validateSplits,
  type RawTxnWithSubs,
} from '../splits'

describe('validateSplits', () => {
  it('rechaza < 2 splits', () => {
    expect(
      validateSplits([{ categoryId: 'a', amount: 100, memo: null }], 100),
    ).toMatch(/al menos 2/)
  })

  it('rechaza monto negativo o cero', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 50, memo: null },
          { categoryId: 'b', amount: 0, memo: null },
        ],
        50,
      ),
    ).toMatch(/positivo/)
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 50, memo: null },
          { categoryId: 'b', amount: -10, memo: null },
        ],
        40,
      ),
    ).toMatch(/positivo/)
  })

  it('rechaza monto NaN/Infinity', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: NaN, memo: null },
          { categoryId: 'b', amount: 50, memo: null },
        ],
        50,
      ),
    ).toMatch(/positivo/)
  })

  it('rechaza si la suma no coincide con el total', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 30, memo: null },
          { categoryId: 'b', amount: 50, memo: null },
        ],
        100, // expected: 80
      ),
    ).toMatch(/no coincide/)
  })

  it('acepta exactamente el total', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 30, memo: null },
          { categoryId: 'b', amount: 70, memo: null },
        ],
        100,
      ),
    ).toBeNull()
  })

  it('tolera redondeo de 0.005', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 33.333, memo: null },
          { categoryId: 'b', amount: 33.333, memo: null },
          { categoryId: 'c', amount: 33.334, memo: null },
        ],
        100,
      ),
    ).toBeNull()
  })

  it('rechaza desviación > 0.005', () => {
    expect(
      validateSplits(
        [
          { categoryId: 'a', amount: 50.0, memo: null },
          { categoryId: 'b', amount: 50.01, memo: null },
        ],
        100,
      ),
    ).toMatch(/no coincide/)
  })
})

describe('expandToCategoryContributions', () => {
  it('non-split: emite una fila con category + amount del padre', () => {
    const txns: RawTxnWithSubs[] = [
      {
        date: '2026-05-01',
        category_id: 'cat-1',
        amount: -100,
        is_split: false,
      },
    ]
    expect(expandToCategoryContributions(txns)).toEqual([
      { date: '2026-05-01', category_id: 'cat-1', amount: -100 },
    ])
  })

  it('split: emite una fila por subtransaction', () => {
    const txns: RawTxnWithSubs[] = [
      {
        date: '2026-05-01',
        category_id: null,
        amount: -100,
        is_split: true,
        subtransactions: [
          { category_id: 'cat-1', amount: -60 },
          { category_id: 'cat-2', amount: -40 },
        ],
      },
    ]
    expect(expandToCategoryContributions(txns)).toEqual([
      { date: '2026-05-01', category_id: 'cat-1', amount: -60 },
      { date: '2026-05-01', category_id: 'cat-2', amount: -40 },
    ])
  })

  it('is_split=true pero sin subtransactions: cae al padre', () => {
    const txns: RawTxnWithSubs[] = [
      {
        date: '2026-05-01',
        category_id: 'cat-1',
        amount: -100,
        is_split: true,
        subtransactions: [],
      },
    ]
    expect(expandToCategoryContributions(txns)).toEqual([
      { date: '2026-05-01', category_id: 'cat-1', amount: -100 },
    ])
  })

  it('subtransactions con string amount se convierte a number', () => {
    const txns: RawTxnWithSubs[] = [
      {
        date: '2026-05-01',
        category_id: null,
        amount: '-100',
        is_split: true,
        subtransactions: [
          { category_id: 'cat-1', amount: '-60.5' },
          { category_id: 'cat-2', amount: '-39.5' },
        ],
      },
    ]
    const result = expandToCategoryContributions(txns)
    expect(result[0].amount).toBe(-60.5)
    expect(result[1].amount).toBe(-39.5)
  })

  it('subtransaction sin category_id queda como null', () => {
    const txns: RawTxnWithSubs[] = [
      {
        date: '2026-05-01',
        category_id: null,
        amount: -100,
        is_split: true,
        subtransactions: [
          { category_id: null, amount: -50 },
          { category_id: 'cat-1', amount: -50 },
        ],
      },
    ]
    const result = expandToCategoryContributions(txns)
    expect(result[0].category_id).toBeNull()
    expect(result[1].category_id).toBe('cat-1')
  })

  it('mezcla split + non-split correctamente', () => {
    const txns: RawTxnWithSubs[] = [
      { date: '2026-05-01', category_id: 'cat-a', amount: -10, is_split: false },
      {
        date: '2026-05-02',
        category_id: null,
        amount: -100,
        is_split: true,
        subtransactions: [
          { category_id: 'cat-b', amount: -60 },
          { category_id: 'cat-c', amount: -40 },
        ],
      },
      { date: '2026-05-03', category_id: 'cat-d', amount: 200, is_split: false },
    ]
    const result = expandToCategoryContributions(txns)
    expect(result).toHaveLength(4)
    expect(result.map((r) => r.amount)).toEqual([-10, -60, -40, 200])
  })
})
