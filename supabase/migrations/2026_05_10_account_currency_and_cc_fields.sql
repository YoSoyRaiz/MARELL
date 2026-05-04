-- ============================================================
-- Migration: per-account currency + credit card metadata
-- 2026-05-10
--
-- Adds:
-- 1. accounts.currency ('DOP' | 'USD'). Each account holds its
--    balance in its own currency. The budget-level currency stays
--    as the display default. Conversion to budget currency for
--    KPIs / patrimonio neto uses budgets.usd_to_dop_rate (already
--    refreshed daily via the BCRD cron).
-- 2. accounts.interest_rate_apr (numeric, percent). Optional APR
--    for credit cards and loans. Plain percentage, e.g. 36.50.
-- 3. accounts.cycle_close_day (smallint 1-31). Day of the month
--    when the credit card statement closes — used later to surface
--    upcoming payment cuts.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

alter table accounts
  add column if not exists currency text not null default 'DOP'
    check (currency in ('DOP', 'USD')),
  add column if not exists interest_rate_apr numeric(6,2)
    check (interest_rate_apr is null or interest_rate_apr >= 0),
  add column if not exists cycle_close_day smallint
    check (cycle_close_day is null or (cycle_close_day between 1 and 31));

comment on column accounts.currency is
  'Native currency the account holds. DOP is the default; USD is converted to DOP for budget-level totals using budgets.usd_to_dop_rate.';
comment on column accounts.interest_rate_apr is
  'Annual percentage rate, e.g. 36.50. Optional — only set for credit cards and loans.';
comment on column accounts.cycle_close_day is
  'Day of the month the credit card statement closes (1-31). Optional.';
