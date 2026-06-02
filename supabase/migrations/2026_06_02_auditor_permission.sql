-- ============================================================
-- Migration: permiso de Auditor Financiero administrable por DB
-- 2026-06-02
--
-- Contexto: hasta hoy el gate del feature multi-cliente para auditores
-- vivía en la env-var MARELL_AUDITOR_ALLOWLIST. Agregar un auditor
-- requería editar Vercel + redeploy. Movemos el permiso a una columna
-- en profiles que el admin puede togglear desde /admin sin tocar
-- código.
--
-- Revocación = pausa: poner is_auditor=false NO termina las
-- agency_relationships del auditor, solo le bloquea el acceso al
-- feature. Si el admin reactiva, recupera todo intacto.
--
-- Seed: el founder (maxtudiodesign@gmail.com) queda como auditor
-- inicial. Los demás emails actualmente en la env-var deben ser
-- seedados manualmente desde /admin después del deploy.
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

-- 1. Columna is_auditor en profiles ─────────────────────────────
alter table public.profiles
  add column if not exists is_auditor boolean not null default false;

-- Índice parcial — solo guarda rows donde el flag es true.
-- Útil porque queremos saber rápido "¿quiénes son auditores?" sin
-- escanear toda la tabla profiles.
create index if not exists profiles_is_auditor_idx
  on public.profiles (is_auditor)
  where is_auditor = true;

-- 2. RPC admin_set_auditor ──────────────────────────────────────
-- Mismo patrón que admin_set_approved. Valida is_admin() y actualiza
-- el flag.
create or replace function public.admin_set_auditor(
  target_id uuid,
  value boolean
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
     set is_auditor = admin_set_auditor.value,
         updated_at = now()
   where id = target_id;
end;
$$;

revoke all on function public.admin_set_auditor(uuid, boolean) from public;
grant execute on function public.admin_set_auditor(uuid, boolean) to authenticated;


-- 3. Extender admin_list_users() para incluir is_auditor ────────
-- Replace de la función para devolver la columna extra. El client del
-- admin panel la usa para pintar el toggle.
--
-- DROP necesario antes del CREATE porque CREATE OR REPLACE no permite
-- cambiar el return type (Postgres 42P13). El drop es seguro: la
-- función se recrea inmediatamente abajo con la misma firma + col extra.
drop function if exists public.admin_list_users();

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
  is_auditor      boolean,
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
    p.is_auditor,
    au.created_at,
    au.last_sign_in_at
  from public.profiles p
  join auth.users au on au.id = p.id
  order by au.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;


-- 4. Seed inicial: el founder ────────────────────────────────────
-- Idempotente — solo cambia profiles existentes.
update public.profiles
   set is_auditor = true,
       updated_at = now()
 where id in (select id from auth.users where email = 'maxtudiodesign@gmail.com')
   and is_auditor = false;
