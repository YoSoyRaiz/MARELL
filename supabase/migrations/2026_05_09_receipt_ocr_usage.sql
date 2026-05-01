-- ============================================================
-- Migration: per-user monthly OCR usage tracking
-- 2026-05-09
--
-- Caps how many receipts a user can send to /api/receipts/parse
-- (Anthropic vision) per calendar month. Free → 3, trial → 15,
-- pro → 50. The plan-to-limit mapping lives in the API route, not
-- here, so we can tweak it without a migration.
--
-- One row per (user, YYYY-MM). The next month auto-resets simply
-- because the row key changes — no cron, no cleanup needed.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists receipt_ocr_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  year_month  text not null,                 -- 'YYYY-MM'
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, year_month)
);

alter table receipt_ocr_usage enable row level security;

-- Users can read their own row (so the UI can show "X/N restantes").
drop policy if exists "ocr_usage_owner_select" on receipt_ocr_usage;
create policy "ocr_usage_owner_select"
  on receipt_ocr_usage for select
  using (user_id = auth.uid());

-- Writes go through the security-definer function below, so we don't
-- expose insert/update to clients directly.

-- Plan-to-cap mapping. Hardcoded in SQL so the client can't lie about
-- their plan limit when calling increment_ocr_usage directly.
create or replace function _ocr_limit_for(p_plan text)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'pro'   then 50
    when p_plan = 'trial' then 15
    else                       3   -- free / null / anything unknown
  end;
$$;

-- ────────────────────────────────────────────────────────────
-- Atomic check-and-increment.
-- Looks up the caller's plan internally and uses the matching cap, so
-- a hostile client cannot pass an inflated limit. Returns allowed=true
-- and the new count if under cap; otherwise allowed=false and the
-- existing count without incrementing.
--
-- Why server-side: doing the check + upsert + increment in two
-- separate calls from the API route would race two simultaneous
-- uploads from the same user (e.g. both pass the check, both
-- increment, count ends 2 over the cap).
-- ────────────────────────────────────────────────────────────
create or replace function increment_ocr_usage()
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_ym    text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select plan into v_plan from profiles where id = v_user;
  v_limit := _ocr_limit_for(v_plan);

  -- Upsert the row, taking a row lock so a concurrent call from the
  -- same user blocks here until we're done.
  insert into receipt_ocr_usage (user_id, year_month, count)
  values (v_user, v_ym, 0)
  on conflict (user_id, year_month) do update
    set updated_at = receipt_ocr_usage.updated_at
  returning count into v_count;

  if v_count >= v_limit then
    return query select false, v_count, v_limit;
    return;
  end if;

  update receipt_ocr_usage
     set count = count + 1,
         updated_at = now()
   where user_id = v_user
     and year_month = v_ym
  returning count into v_count;

  return query select true, v_count, v_limit;
end;
$$;

grant execute on function increment_ocr_usage() to authenticated;
-- Drop the old signature so old clients can't keep calling the unsafe
-- one. Safe to run repeatedly.
drop function if exists increment_ocr_usage(integer);

-- Read-only helper for the UI: "how many do I have left?".
create or replace function get_ocr_usage()
returns table(used integer, year_month text)
language sql
security definer
set search_path = public
as $$
  select coalesce(count, 0) as used,
         coalesce(year_month, to_char(now() at time zone 'UTC', 'YYYY-MM')) as year_month
    from receipt_ocr_usage
   where user_id = auth.uid()
     and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM')
   union all
  select 0, to_char(now() at time zone 'UTC', 'YYYY-MM')
   where not exists (
     select 1 from receipt_ocr_usage
      where user_id = auth.uid()
        and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM')
   )
   limit 1;
$$;

grant execute on function get_ocr_usage() to authenticated;

-- Refund a slot when the upstream vision call fails after we
-- already incremented. Never goes below zero.
create or replace function decrement_ocr_usage()
returns void
language sql
security definer
set search_path = public
as $$
  update receipt_ocr_usage
     set count = greatest(count - 1, 0),
         updated_at = now()
   where user_id = auth.uid()
     and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM');
$$;

grant execute on function decrement_ocr_usage() to authenticated;
