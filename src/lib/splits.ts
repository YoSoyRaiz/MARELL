// Helpers for handling split transactions across the app.
//
// A "split" transaction has a parent row in `transactions` (with is_split=true,
// category_id=null) and 2+ child rows in `subtransactions` that hold the
// category_id and amount for each piece. Account balances are computed from
// the parent only; per-category numbers must use the children.

export interface RawTxnWithSubs {
  date: string
  category_id?: string | null
  amount: number | string
  is_split?: boolean | null
  // The Supabase typed client doesn't infer the join shape because the
  // generated Database type has no Relationships declared. Accept the field
  // loosely so call sites don't need to cast away SelectQueryError sentinels.
  subtransactions?: unknown
}

export interface CategoryContribution {
  date: string
  category_id: string | null
  amount: number // signed: + income, − expense
}

/**
 * Expands transactions into one row per category-affecting amount.
 *
 * - For non-split transactions: emits a single row with the parent's
 *   category_id and signed amount.
 * - For split transactions: emits one row per subtransaction.
 *
 * This is what every "spending per category" calculation in the app should
 * iterate over, so splits are counted correctly.
 */
interface SubLike {
  category_id: string | null
  amount: number | string
}

function isSubArray(value: unknown): value is SubLike[] {
  return Array.isArray(value)
}

export function expandToCategoryContributions(
  txns: RawTxnWithSubs[],
): CategoryContribution[] {
  const out: CategoryContribution[] = []
  for (const t of txns) {
    const subs = isSubArray(t.subtransactions) ? t.subtransactions : null
    if (t.is_split && subs && subs.length > 0) {
      for (const s of subs) {
        out.push({
          date: t.date,
          category_id: s.category_id ?? null,
          amount: Number(s.amount),
        })
      }
    } else {
      out.push({
        date: t.date,
        category_id: t.category_id ?? null,
        amount: Number(t.amount),
      })
    }
  }
  return out
}
