-- ============================================================
-- Migration: audit log para cambios de tasa USD↔DOP
-- 2026-05-24
--
-- Contexto: la auditoría (M9) encontró que update-fx-rate aplica una
-- tasa a TODOS los budgets sin trackear de dónde vino, cuándo, ni
-- quién/qué la disparó. Si alguien (vía CRON_SECRET filtrado) escribe
-- una tasa maliciosa, no hay forma de detectarlo después.
--
-- Esta migration crea fx_rate_audit con una fila por ejecución del cron.
--
-- Lectura RLS: solo admins (vía is_admin()). El cron escribe usando
-- admin client así que RLS no aplica al write.
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

create table if not exists public.fx_rate_audit (
  id              uuid primary key default gen_random_uuid(),
  rate            numeric(8,4) not null,
  source          text not null,            -- 'bcrd' | 'open-er-api' | manual
  budgets_updated integer not null default 0,
  applied_at      timestamptz not null default now()
);

create index if not exists fx_rate_audit_applied_at_idx
  on public.fx_rate_audit (applied_at desc);

alter table public.fx_rate_audit enable row level security;

drop policy if exists "fx_audit_admin_select" on public.fx_rate_audit;
create policy "fx_audit_admin_select"
  on public.fx_rate_audit for select
  using (public.is_admin());

-- Sin policies para INSERT/UPDATE/DELETE — solo el cron escribe vía
-- admin client (bypassa RLS).
