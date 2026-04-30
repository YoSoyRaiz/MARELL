-- ============================================================
-- Migration: delete_my_account RPC for full self-service account deletion
-- 2026-04-29
--
-- Lets an authenticated user delete their own auth.users row + cascade
-- through their budget data + profile in a single transaction. Postgres
-- RLS prevents deleting other users' rows because the function only
-- targets auth.uid().
--
-- Run once in Supabase SQL Editor.
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No authenticated user';
  end if;

  -- Wipe owned budget data first. The cascade defined on accounts,
  -- categories, transactions, etc. handles the rest.
  delete from public.budgets where created_by = uid;

  -- Profiles are FK'd to auth.users with on delete cascade, but delete
  -- explicitly to keep the order obvious if someone reads this later.
  delete from public.profiles where id = uid;

  -- Finally remove the auth user. The function runs as the function owner
  -- (postgres in Supabase), which has privileges on the auth schema.
  delete from auth.users where id = uid;
end;
$$;

-- Lock down: only authenticated users can call it (and only on themselves
-- because the body uses auth.uid()).
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
