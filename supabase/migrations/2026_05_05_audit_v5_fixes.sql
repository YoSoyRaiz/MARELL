-- ============================================================
-- Migration: Audit v5 hardening
-- 2026-05-05
--
-- Closes the remaining blind spots from the 5th audit:
--   1. Re-sync historical account balances from transactions so any
--      drift accumulated before the trigger landed is corrected.
--   2. Cron-lock TTL: locks older than 12 hours are auto-cleaned so
--      a failed cron run doesn't stay locked all day.
--   3. Role-aware RLS: viewers can SELECT, editors+owners can write.
--      The schema had role columns but RLS only checked membership.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── 1. Reconcile historical balances ───────────────────────
-- Any account whose stored balance doesn't match the sum of its
-- transactions gets corrected. Run once after the trigger from
-- migration 2026_05_04 went live.
update accounts a
set balance = round(coalesce((
  select sum(t.amount)
  from transactions t
  where t.account_id = a.id
), 0)::numeric, 2)
where a.balance is distinct from coalesce((
  select sum(t.amount)
  from transactions t
  where t.account_id = a.id
), 0);

-- ── 2. Cron lock TTL ───────────────────────────────────────
-- Without TTL a failed cron stays locked forever. The new lock
-- helper deletes anything older than 12h so the next day's run
-- (or a manual retry) can proceed.

create or replace function cleanup_stale_cron_locks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  delete from cron_runs
    where created_at < now() - interval '12 hours';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Call it every time a fresh cron tries to lock. Cheap.
create or replace function acquire_cron_lock(
  p_route text,
  p_run_date date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cleanup_stale_cron_locks();
  begin
    insert into cron_runs (route, run_date)
    values (p_route, p_run_date);
    return true;
  exception when unique_violation then
    return false;
  end;
end;
$$;

-- ── 3. Role-aware RLS ──────────────────────────────────────
-- The existing "member_all" policies treat every member the same.
-- Add a helper that exposes the role and rewrite the write-path
-- policies to require editor/owner.

create or replace function current_member_role(bid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from budget_members
    where budget_id = bid and user_id = auth.uid()
    limit 1
$$;

-- accounts: viewers can SELECT, editors+owners can write.
drop policy if exists "member_all" on accounts;
create policy "member_select" on accounts for select
  using (is_budget_member(budget_id));
create policy "member_write" on accounts for insert
  with check (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_update" on accounts for update
  using (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_delete" on accounts for delete
  using (current_member_role(budget_id) in ('owner', 'editor'));

-- transactions: same split. Viewers see history, only editors mutate.
drop policy if exists "member_all" on transactions;
create policy "member_select" on transactions for select
  using (is_budget_member(budget_id));
create policy "member_write" on transactions for insert
  with check (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_update" on transactions for update
  using (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_delete" on transactions for delete
  using (current_member_role(budget_id) in ('owner', 'editor'));

-- monthly_assignments: same.
drop policy if exists "member_all" on monthly_assignments;
create policy "member_select" on monthly_assignments for select
  using (is_budget_member(budget_id));
create policy "member_write" on monthly_assignments for insert
  with check (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_update" on monthly_assignments for update
  using (current_member_role(budget_id) in ('owner', 'editor'));
create policy "member_delete" on monthly_assignments for delete
  using (current_member_role(budget_id) in ('owner', 'editor'));

-- categories + category_groups: editor+owner only.
drop policy if exists "member_all" on categories;
create policy "member_select" on categories for select
  using (is_budget_member(budget_id));
create policy "member_write" on categories for all
  using (current_member_role(budget_id) in ('owner', 'editor'))
  with check (current_member_role(budget_id) in ('owner', 'editor'));

drop policy if exists "member_all" on category_groups;
create policy "member_select" on category_groups for select
  using (is_budget_member(budget_id));
create policy "member_write" on category_groups for all
  using (current_member_role(budget_id) in ('owner', 'editor'))
  with check (current_member_role(budget_id) in ('owner', 'editor'));

-- scheduled_transactions and payees: same pattern.
drop policy if exists "member_all" on scheduled_transactions;
create policy "member_select" on scheduled_transactions for select
  using (is_budget_member(budget_id));
create policy "member_write" on scheduled_transactions for all
  using (current_member_role(budget_id) in ('owner', 'editor'))
  with check (current_member_role(budget_id) in ('owner', 'editor'));

drop policy if exists "member_all" on payees;
create policy "member_select" on payees for select
  using (is_budget_member(budget_id));
create policy "member_write" on payees for all
  using (current_member_role(budget_id) in ('owner', 'editor'))
  with check (current_member_role(budget_id) in ('owner', 'editor'));

-- subtransactions: inherits via parent transaction.
drop policy if exists "member_all" on subtransactions;
create policy "member_select" on subtransactions for select
  using (exists (
    select 1 from transactions t
    where t.id = transaction_id and is_budget_member(t.budget_id)
  ));
create policy "member_write" on subtransactions for all
  using (exists (
    select 1 from transactions t
    where t.id = transaction_id
      and current_member_role(t.budget_id) in ('owner', 'editor')
  ))
  with check (exists (
    select 1 from transactions t
    where t.id = transaction_id
      and current_member_role(t.budget_id) in ('owner', 'editor')
  ));
