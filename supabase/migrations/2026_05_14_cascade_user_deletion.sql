-- ============================================================
-- Migration: cascade auth.users deletion through user-owned rows
-- 2026-05-14
--
-- Today `profiles.id → auth.users` cascades, but
-- `budgets.created_by → auth.users` and
-- `budget_members.user_id → auth.users` do NOT. Result: deleting a
-- user from the Supabase admin dashboard fails with an FK violation
-- the moment they own any budget data — even ghost test accounts.
--
-- Fix: replace both constraints with `on delete cascade`. From here
-- on, deleting an auth.users row removes:
--   1. profiles  (already cascade)
--   2. budgets   (new) → which cascades to accounts, categories,
--      category_groups, payees, transactions, splits, assignments,
--      scheduled, goals (all already `on delete cascade` to budgets)
--   3. budget_members (new)
--
-- Idempotent: drops any FK on those columns regardless of its
-- generated name, then re-adds the cascading version. Safe to re-run.
-- This migration changes RULES, not DATA — running it does not
-- delete anything.
--
-- Run once in Supabase SQL Editor.
-- ============================================================

-- ── budgets.created_by ──────────────────────────────────────────
do $$
declare
  fk_name text;
begin
  -- Find whatever name the existing FK has (auto-generated names vary
  -- across environments, so we discover instead of hardcoding).
  select tc.constraint_name
    into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema    = kcu.table_schema
   where tc.table_schema    = 'public'
     and tc.table_name      = 'budgets'
     and tc.constraint_type = 'FOREIGN KEY'
     and kcu.column_name    = 'created_by';

  if fk_name is not null then
    execute format('alter table public.budgets drop constraint %I', fk_name);
  end if;
end $$;

alter table public.budgets
  add constraint budgets_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete cascade;

-- ── budget_members.user_id ─────────────────────────────────────
do $$
declare
  fk_name text;
begin
  select tc.constraint_name
    into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema    = kcu.table_schema
   where tc.table_schema    = 'public'
     and tc.table_name      = 'budget_members'
     and tc.constraint_type = 'FOREIGN KEY'
     and kcu.column_name    = 'user_id';

  if fk_name is not null then
    execute format('alter table public.budget_members drop constraint %I', fk_name);
  end if;
end $$;

alter table public.budget_members
  add constraint budget_members_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

-- ── Sanity check: confirm both FKs now cascade ─────────────────
-- (Optional read-only query — leave it in place so re-runs show
-- you the current state.)
do $$
declare
  r record;
begin
  for r in
    select
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    from information_schema.referential_constraints rc
    join information_schema.table_constraints tc
      on rc.constraint_name = tc.constraint_name
     and rc.constraint_schema = tc.table_schema
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema    = kcu.table_schema
   where tc.table_schema = 'public'
     and tc.table_name in ('budgets', 'budget_members')
     and kcu.column_name in ('created_by', 'user_id')
  loop
    raise notice 'FK on %.%: delete_rule = %', r.table_name, r.column_name, r.delete_rule;
  end loop;
end $$;
