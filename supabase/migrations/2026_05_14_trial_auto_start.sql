-- ============================================================
-- Migration: 31-day trial auto-start on signup
-- 2026-05-14
--
-- Every new user gets `subscription_status='trialing'` and
-- `pro_expires_at = now() + 31 days` immediately on profile
-- creation, so the trial countdown begins without any extra step.
-- Existing rows are NOT touched (idempotent: only sets when both
-- fields are null).
--
-- The trigger fires AFTER INSERT on profiles. We don't hook
-- auth.users directly because profile rows are created by app code
-- (signup action) after the auth row exists, and triggering at the
-- profile level keeps the data path single-source.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

create or replace function public.start_trial_on_profile_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only seed defaults — don't overwrite if something already set
  -- these fields (e.g. an admin pre-provisioning a paid account).
  if new.subscription_status is null then
    new.subscription_status := 'trialing';
  end if;
  if new.pro_expires_at is null then
    new.pro_expires_at := now() + interval '31 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_start_trial_on_profile_create on public.profiles;

create trigger trg_start_trial_on_profile_create
  before insert on public.profiles
  for each row
  execute function public.start_trial_on_profile_create();

-- Backfill: any existing user whose profile predates this migration
-- and has no subscription state yet gets a fresh 31-day trial too,
-- so we don't accidentally lock anyone out.
update public.profiles
   set subscription_status = 'trialing',
       pro_expires_at = now() + interval '31 days'
 where subscription_status is null
   and pro_expires_at is null;
