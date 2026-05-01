-- ============================================================
-- Migration: admin_delete_user — fully removes a user from the system
-- 2026-05-01
--
-- Used by /admin to permanently remove a user. Cascades through their
-- budget data + budget memberships + profile, then deletes the
-- auth.users row.
--
-- Run once in Supabase SQL Editor (idempotent CREATE OR REPLACE).
-- ============================================================

create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if target_id is null then
    raise exception 'target_id required';
  end if;

  -- Owned budgets cascade through accounts / categories / transactions /
  -- assignments / scheduled_transactions / etc.
  delete from public.budgets where created_by = target_id;

  -- Memberships in shared budgets (no on-delete-cascade against auth.users
  -- so we have to clear these manually before removing the auth row).
  delete from public.budget_members where user_id = target_id;

  -- Profile cascades from auth.users on delete, but explicit is clearer.
  delete from public.profiles where id = target_id;

  -- Finally remove the auth user.
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
