-- ============================================================
-- Migration: mueve la allowlist de admin a una tabla
-- 2026-05-24
--
-- Contexto: la auditoría (M2) encontró que is_admin() tenía el email
-- del admin hardcoded en SQL. Si el admin cambia su email, pierde
-- acceso hasta correr una migration. Mover a una tabla normaliza
-- esto y permite añadir/quitar admins sin redeploy.
--
-- La tabla admin_users tiene RLS deny-all — solo lecturas vía
-- is_admin() (SECURITY DEFINER que bypassa RLS). No se expone al
-- cliente bajo ninguna circunstancia.
--
-- Seed: el email actual (maxtudiodesign@gmail.com) se sigue
-- registrando para no perder acceso durante la transición. Para añadir
-- más admins en el futuro:
--   insert into admin_users(user_id)
--   select id from auth.users where email = 'nuevo@admin.com';
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  note       text
);

alter table public.admin_users enable row level security;

-- Deny-all RLS. Solo is_admin() (SECURITY DEFINER) puede leer esta
-- tabla. Si por error alguien hace `select * from admin_users` desde
-- el cliente, no devuelve nada.
drop policy if exists "admin_users_deny_all" on public.admin_users;
create policy "admin_users_deny_all"
  on public.admin_users for all
  using (false);

-- Backfill: el admin actual sigue siendo admin después de esta migration.
-- Busca el user_id por email; si el email cambió desde el setup
-- original, ajusta manualmente.
insert into public.admin_users (user_id, note)
select id, 'backfilled from hardcoded allowlist 2026-05-24'
  from auth.users
 where email = 'maxtudiodesign@gmail.com'
   and id not in (select user_id from public.admin_users)
on conflict do nothing;

-- Reemplaza la implementación de is_admin() para consultar la tabla
-- en vez del array literal. Mantiene la misma firma así que el resto
-- del schema y las funciones admin_* siguen funcionando sin cambios.
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
