// Pure, sync helpers for the credit-card auto-bucket math. Lives in
// its own module (not actions.ts) because that file is `'use server'`
// — every export there has to be async, and these helpers aren't.
// Splitting also makes them straightforward to unit-test.

export type AutoBucketContribution = {
  amount: number // signed (negative = expense)
  categoryId: string | null
}

/**
 * For a credit-card-account transaction, returns the signed delta to
 * apply to the CC payment bucket. The bucket moves opposite to the
 * transaction sign so a -500 charge bumps the bucket by +500 (more to
 * pay) and a +200 refund knocks it down by 200.
 *
 * Splits walk every subtransaction so the bucket math reflects the
 * actual category spend, not the parent total. Uncategorized
 * contributions are skipped — they shouldn't move the bucket because
 * they haven't entered the budget yet.
 */
export function ccBucketDelta(
  contributions: AutoBucketContribution[],
): number {
  let delta = 0
  for (const c of contributions) {
    if (!c.categoryId) continue
    delta += -c.amount
  }
  return Math.round(delta * 100) / 100
}
