-- ============================================================
-- Migration: extiende el trial de 31 a 90 días
-- 2026-05-24
--
-- Cambios:
--   1. Reemplaza `start_trial_on_profile_create` para que los signups
--      nuevos reciban 90 días en vez de 31.
--   2. Backfill: a cada trial activo se le suman 59 días extra
--      (90 - 31), preservando el bonus parejo para todos.
--      No toca trials ya expirados ni usuarios que ya pagaron Pro.
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
    new.trial_ends_at := now() + interval '90 days';
  end if;
  if new.subscription_status is null then
    new.subscription_status := 'trialing';
  end if;
  return new;
end;
$$;

-- Trigger ya existe; CREATE OR REPLACE FUNCTION arriba basta. Pero si
-- por algún motivo se borró, lo recreamos.
drop trigger if exists trg_start_trial_on_profile_create on public.profiles;

create trigger trg_start_trial_on_profile_create
  before insert on public.profiles
  for each row
  execute function public.start_trial_on_profile_create();

-- Backfill: cada trial activo recibe los 59 días extra (90 - 31). Esto
-- preserva el bonus parejo: alguien que iba a vencer mañana ahora vence
-- en 60 días; alguien que se registró ayer (30 días) pasa a 89 días.
-- Solo aplica a quienes:
--   - Tienen plan='trial'
--   - trial_ends_at todavía está en el futuro (no extendemos trials
--     ya expirados — esos son leads para upselling, no clientes activos)
--   - No tienen una suscripción Pro activa pisándolo
update public.profiles
   set trial_ends_at = trial_ends_at + interval '59 days'
 where plan = 'trial'
   and trial_ends_at is not null
   and trial_ends_at > now()
   and (pro_expires_at is null or pro_expires_at <= now());
