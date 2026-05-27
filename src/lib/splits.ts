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
  // Optional: cuando viene presente, las contributions hijas heredan
  // el account_id del parent. Necesario para conversión multi-currency
  // en reportes de Análisis (cada cuenta tiene su propia moneda).
  account_id?: string | null
  // The Supabase typed client doesn't infer the join shape because the
  // generated Database type has no Relationships declared. Accept the field
  // loosely so call sites don't need to cast away SelectQueryError sentinels.
  subtransactions?: unknown
}

export interface CategoryContribution {
  date: string
  category_id: string | null
  amount: number // signed: + income, − expense
  // Hereda del parent. Vacío si el caller no incluyó account_id en la
  // query. Los reportes de Análisis lo usan para currency conversion.
  account_id: string
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
    const accountId = (t.account_id ?? '') as string
    const subs = isSubArray(t.subtransactions) ? t.subtransactions : null
    if (t.is_split && subs && subs.length > 0) {
      for (const s of subs) {
        out.push({
          date: t.date,
          category_id: s.category_id ?? null,
          amount: Number(s.amount),
          account_id: accountId,
        })
      }
    } else {
      out.push({
        date: t.date,
        category_id: t.category_id ?? null,
        amount: Number(t.amount),
        account_id: accountId,
      })
    }
  }
  return out
}

// ── Split validation ─────────────────────────────────────────────
// Movido aquí desde transacciones/actions.ts para hacerlo testeable
// sin tener que importar el módulo 'use server' completo. La lógica
// es pura — no toca DB ni hooks.

export interface SplitInput {
  categoryId: string | null
  amount: number // positive (sign comes from parent's `type`)
  memo: string | null
}

/**
 * Valida que la suma de los splits cuadre con el total del padre
 * (dentro de tolerancia de redondeo de 0.005). Devuelve null si OK,
 * o un mensaje de error.
 */
export function validateSplits(
  splits: SplitInput[],
  total: number,
): string | null {
  if (splits.length < 2) return 'Un split necesita al menos 2 categorías'
  let sum = 0
  for (const s of splits) {
    if (!Number.isFinite(s.amount) || s.amount <= 0) {
      return 'Cada split debe tener monto positivo'
    }
    sum += s.amount
  }
  if (Math.abs(sum - total) > 0.005) {
    return `La suma de los splits ($${sum.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`
  }
  return null
}
