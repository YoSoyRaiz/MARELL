import { describe, it, expect } from 'vitest'
import { ccBucketDelta, type AutoBucketContribution } from '../actions'

describe('ccBucketDelta', () => {
  it('returns 0 for an empty contribution list', () => {
    expect(ccBucketDelta([])).toBe(0)
  })

  it('moves the bucket up by the absolute value of a charge', () => {
    // A -500 charge means we owe 500 more on the card → bucket +500.
    const contribs: AutoBucketContribution[] = [
      { amount: -500, categoryId: 'cat-1' },
    ]
    expect(ccBucketDelta(contribs)).toBe(500)
  })

  it('moves the bucket down on a refund (positive amount)', () => {
    const contribs: AutoBucketContribution[] = [
      { amount: 200, categoryId: 'cat-1' },
    ]
    expect(ccBucketDelta(contribs)).toBe(-200)
  })

  it('ignores contributions without a category', () => {
    const contribs: AutoBucketContribution[] = [
      { amount: -1000, categoryId: null },
    ]
    expect(ccBucketDelta(contribs)).toBe(0)
  })

  it('sums across multiple split children', () => {
    const contribs: AutoBucketContribution[] = [
      { amount: -300, categoryId: 'cat-food' },
      { amount: -200, categoryId: 'cat-fun' },
    ]
    expect(ccBucketDelta(contribs)).toBe(500)
  })

  it('rounds to 2 decimals', () => {
    const contribs: AutoBucketContribution[] = [
      { amount: -333.333, categoryId: 'cat-1' },
    ]
    expect(ccBucketDelta(contribs)).toBe(333.33)
  })

  it('handles a mixed split (refund + charge)', () => {
    const contribs: AutoBucketContribution[] = [
      { amount: -500, categoryId: 'cat-1' },
      { amount: 100, categoryId: 'cat-2' },
    ]
    expect(ccBucketDelta(contribs)).toBe(400)
  })
})
