-- ============================================================
-- Migration: composite indexes for hot query paths
-- 2026-05-06
--
-- Every dashboard load runs these patterns. Without composite
-- indexes Supabase has to seq-scan as the table grows. Locking these
-- in now is cheap; doing it after 100k rows is painful.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Transactions filtered by budget + date range (dashboard, analisis,
-- cash-flow forecast, drill-down). DESC matches the typical "most
-- recent first" sort order so the planner can read the index in
-- order.
create index if not exists transactions_budget_date_idx
  on transactions(budget_id, date desc);

-- Transactions by category — used by drill-down and per-category
-- analysis. WHERE category_id IS NOT NULL covers the typical query
-- and keeps the index small (uncategorized rows are excluded).
create index if not exists transactions_category_idx
  on transactions(category_id, date desc)
  where category_id is not null;

-- Transactions by account — used by reconcile, transfers, account
-- detail views.
create index if not exists transactions_account_date_idx
  on transactions(account_id, date desc);

-- Transfer pair lookups — small but heavily used during edit/delete.
create index if not exists transactions_transfer_idx
  on transactions(transfer_transaction_id)
  where transfer_transaction_id is not null;

-- Subtransactions by parent — used in delete cascades and split UI.
create index if not exists subtransactions_parent_idx
  on subtransactions(transaction_id);

-- Subtransactions by category for drill-down + per-category aggregate.
create index if not exists subtransactions_category_idx
  on subtransactions(category_id)
  where category_id is not null;

-- Monthly assignments by budget + month — covers the assignment
-- queries on every Plan / Resumen load.
create index if not exists monthly_assignments_budget_month_idx
  on monthly_assignments(budget_id, month);

-- Scheduled txns: the cash-flow forecast and the cron loop both
-- filter by (budget_id, active=true, next_date).
create index if not exists scheduled_active_due_idx
  on scheduled_transactions(budget_id, next_date)
  where active = true;

-- Profiles: webhook lookups by external subscription id.
create index if not exists profiles_subscription_external_idx
  on profiles(subscription_external_id)
  where subscription_external_id is not null;

-- Profiles for cron renewals — finding "active azul subs whose next
-- billing has passed".
create index if not exists profiles_azul_renewal_idx
  on profiles(next_billing_at)
  where subscription_provider = 'azul'
    and subscription_status = 'active';

-- Budget members lookup — RLS calls is_budget_member() for nearly
-- every row read. Index by user makes that single-row probe instant.
create index if not exists budget_members_user_budget_idx
  on budget_members(user_id, budget_id);

-- Categories by budget excluding hidden — every plan / resumen load.
create index if not exists categories_budget_visible_idx
  on categories(budget_id, sort_order)
  where hidden = false;

-- Accounts by budget excluding closed — totalCash / Net Worth.
create index if not exists accounts_budget_open_idx
  on accounts(budget_id, sort_order)
  where closed = false;
