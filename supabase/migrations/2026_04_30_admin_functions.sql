-- ============================================================
-- Migration: admin RPC functions for the founder dashboard
-- 2026-04-30
--
-- Adds an allowlist-gated set of security-definer functions so a
-- single admin (the founder) can list and manage users from /admin
-- without bypassing RLS or shipping a service-role key to the app.
--
-- Allowlist is hard-coded in is_admin() — to add admins, edit the
-- function and re-run this migration (CREATE OR REPLACE makes it
-- idempotent).
--
-- Run once in Supabase SQL Editor.
-- ============================================================

-- 1. Admin gate ─────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_email text;
begin
  if auth.uid() is null then
    return false;
  end if;
  select au.email into caller_email from auth.users au where au.id = auth.uid();
  -- Edit this list to grant admin access to additional emails.
  return caller_email = any (array['maxtudiodesign@gmail.com']);
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- 2. List users with profile + auth email ──────────────────────
create or replace function public.admin_list_users()
returns table (
  id              uuid,
  email           text,
  display_name    text,
  plan            text,
  trial_ends_at   timestamptz,
  pro_expires_at  timestamptz,
  approved        boolean,
  onboarded       boolean,
  signed_up_at    timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    au.email::text,
    p.display_name,
    p.plan,
    p.trial_ends_at,
    p.pro_expires_at,
    p.approved,
    p.onboarded,
    au.created_at,
    au.last_sign_in_at
  from public.profiles p
  join auth.users au on au.id = p.id
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;


-- 3. Mark a manual transfer payment received ───────────────────
-- Sets plan='pro', extends pro_expires_at by N months from the later of
-- (now, current pro_expires_at) so consecutive payments stack instead of
-- overwriting unused time, and force-approves the user.
create or replace function public.admin_record_payment(
  target_id uuid,
  months int default 1
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  base_date timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if months is null or months < 1 or months > 24 then
    raise exception 'months must be between 1 and 24';
  end if;

  select greatest(now(), coalesce(pro_expires_at, now()))
    into base_date
    from public.profiles where id = target_id;

  update public.profiles
     set plan = 'pro',
         pro_expires_at = base_date + (months || ' months')::interval,
         approved = true,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_record_payment(uuid, int) from public;
grant execute on function public.admin_record_payment(uuid, int) to authenticated;


-- 4. Extend trial by N days ─────────────────────────────────────
create or replace function public.admin_extend_trial(
  target_id uuid,
  days int default 7
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  base_date timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if days is null or days < 1 or days > 365 then
    raise exception 'days must be between 1 and 365';
  end if;

  select greatest(now(), coalesce(trial_ends_at, now()))
    into base_date
    from public.profiles where id = target_id;

  update public.profiles
     set plan = 'trial',
         trial_ends_at = base_date + (days || ' days')::interval,
         approved = true,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_extend_trial(uuid, int) from public;
grant execute on function public.admin_extend_trial(uuid, int) to authenticated;


-- 5. Set approved flag (block / unblock) ────────────────────────
create or replace function public.admin_set_approved(
  target_id uuid,
  approved boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
     set approved = admin_set_approved.approved,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_set_approved(uuid, boolean) from public;
grant execute on function public.admin_set_approved(uuid, boolean) to authenticated;


-- 6. Set plan to free (revert from pro / cancel) ────────────────
create or replace function public.admin_set_free(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
     set plan = 'free',
         pro_expires_at = null,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_set_free(uuid) from public;
grant execute on function public.admin_set_free(uuid) to authenticated;
