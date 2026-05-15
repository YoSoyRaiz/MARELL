-- ============================================================
-- Migration: corrige el trial auto-start para usar trial_ends_at
-- 2026-05-14 (fix del migration anterior 2026_05_14_trial_auto_start.sql)
--
-- El migration anterior seteaba pro_expires_at, pero la columna correcta
-- para "cuándo termina el trial" es `trial_ends_at`. `pro_expires_at` es
-- para usuarios que ya pagaron Pro. Esto causaba que el banner/notif de
-- trial de la app no se disparara para users nuevos.
--
-- Cambios:
--   1. Reemplaza la función para setear `plan='trial'` + `trial_ends_at`
--   2. Backfill: cualquier profile con `pro_expires_at` set y sin
--      `trial_ends_at` (efecto del bug anterior) se corrige
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

create or replace function public.start_trial_on_profile_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo seed defaults — no sobrescribe si algo ya seteó estos campos
  -- (admin pre-provisioning, pago anticipado, etc.).
  if new.plan is null or new.plan = 'free' then
    new.plan := 'trial';
  end if;
  if new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '31 days';
  end if;
  if new.subscription_status is null then
    new.subscription_status := 'trialing';
  end if;
  return new;
end;
$$;

-- El trigger ya existe del migration anterior; CREATE OR REPLACE FUNCTION
-- arriba ya basta para que use la nueva lógica. Pero si por algún motivo
-- el trigger no existe, lo recreamos.
drop trigger if exists trg_start_trial_on_profile_create on public.profiles;

create trigger trg_start_trial_on_profile_create
  before insert on public.profiles
  for each row
  execute function public.start_trial_on_profile_create();

-- Backfill 1: corrige profiles donde el migration anterior puso fecha en
-- pro_expires_at pero trial_ends_at quedó vacío. Mueve el valor al campo
-- correcto y limpia el otro.
update public.profiles
   set trial_ends_at = pro_expires_at,
       pro_expires_at = null
 where trial_ends_at is null
   and pro_expires_at is not null
   and (subscription_status = 'trialing' or subscription_status is null)
   and (plan = 'trial' or plan = 'free' or plan is null);

-- Backfill 2: cualquier profile sin estado de trial sigue recibiendo
-- uno fresco (igual que el migration anterior).
update public.profiles
   set plan = 'trial',
       trial_ends_at = now() + interval '31 days',
       subscription_status = 'trialing'
 where trial_ends_at is null
   and pro_expires_at is null
   and (subscription_status is null or subscription_status = 'trialing');
