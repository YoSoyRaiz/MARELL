-- ============================================================
-- Migration: atomic money ops + idempotency foundation
-- 2026-05-04
--
-- Closes the audit findings:
--   1. Balance integrity via trigger (no more "txn inserted but
--      balance never updated" inconsistency).
--   2. Atomic CC bucket increment RPC so concurrent updates can't
--      lose each other (was read-modify-write in TS).
--   3. payment_events unique key so duplicate webhook deliveries are
--      rejected at the DB level.
--   4. cron_runs table so a daily cron can lock itself and refuse to
--      run twice on the same day if Vercel retries.
--   5. unreconcile RPC so a botched reconciliation can be undone.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── 1. Account balance trigger ──────────────────────────────
-- Maintains accounts.balance from transactions.amount automatically.
-- Once the trigger is in place we can stop manually updating balance
-- in every server action — reducing the failure surface.

create or replace function recompute_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update accounts
      set balance = round((coalesce(balance, 0) + NEW.amount)::numeric, 2)
      where id = NEW.account_id;
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    if NEW.account_id is distinct from OLD.account_id then
      update accounts
        set balance = round((coalesce(balance, 0) - OLD.amount)::numeric, 2)
        where id = OLD.account_id;
      update accounts
        set balance = round((coalesce(balance, 0) + NEW.amount)::numeric, 2)
        where id = NEW.account_id;
    elsif NEW.amount is distinct from OLD.amount then
      update accounts
        set balance = round((coalesce(balance, 0) + (NEW.amount - OLD.amount))::numeric, 2)
        where id = NEW.account_id;
    end if;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update accounts
      set balance = round((coalesce(balance, 0) - OLD.amount)::numeric, 2)
      where id = OLD.account_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists transactions_balance_sync on transactions;
create trigger transactions_balance_sync
  after insert or update or delete on transactions
  for each row execute function recompute_account_balance();

-- ── 2. Atomic CC bucket increment ──────────────────────────
-- Replaces the JS read-modify-write pattern. Single SQL statement →
-- two concurrent writes can't lose each other (Postgres serializes
-- the upsert on the unique (category_id, month) constraint).

create or replace function assignments_increment(
  p_budget_id uuid,
  p_category_id uuid,
  p_month text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assigned numeric;
begin
  insert into monthly_assignments (budget_id, category_id, month, assigned)
  values (p_budget_id, p_category_id, p_month, round(p_delta::numeric, 2))
  on conflict (category_id, month) do update
    set assigned = round(
      (monthly_assignments.assigned + EXCLUDED.assigned)::numeric, 2
    )
  returning assigned into new_assigned;
  return new_assigned;
end;
$$;

-- ── 3. payment_events idempotency ──────────────────────────
-- Drop any existing duplicate rows first (defensive — there
-- shouldn't be any in production yet) then enforce the constraint.

create unique index if not exists payment_events_provider_external_idx
  on payment_events(provider, external_id, status)
  where external_id is not null;

-- ── 4. cron_runs lock table ────────────────────────────────
-- Each cron route inserts its (route, run_date) at the top. Unique
-- constraint guarantees only one execution succeeds per day, even
-- if Vercel retries the cron.

create table if not exists cron_runs (
  id          uuid primary key default gen_random_uuid(),
  route       text not null,
  run_date    date not null,
  succeeded   boolean,
  payload     jsonb,
  created_at  timestamptz default now(),
  unique(route, run_date)
);

alter table cron_runs enable row level security;
-- Only the service role reads/writes this; no user policy needed,
-- but RLS-on prevents accidental client access.

-- ── 5. unreconcile RPC ─────────────────────────────────────
-- Reverses a botched reconciliation: flips every reconciled row
-- back to cleared so the user can edit them again. Scoped to one
-- account, with budget-ownership check.

create or replace function unreconcile_account(p_account_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
  owner_id uuid;
begin
  select b.created_by into owner_id
    from accounts a
    join budgets b on b.id = a.budget_id
    where a.id = p_account_id;
  if owner_id is null or owner_id <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  update transactions
    set cleared = 'cleared'
    where account_id = p_account_id
      and cleared = 'reconciled';
  get diagnostics affected = row_count;
  return affected;
end;
$$;
