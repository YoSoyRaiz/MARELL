-- ============================================================
-- Migration: multi-budget para auditores
-- 2026-05-28
--
-- Habilita el caso de uso "Auditor con N clientes":
--   1. Agrega el rol 'auditor' al check constraint de budget_members
--      (read-only pero con visibilidad explícita y exportación).
--   2. Crea agency_relationships — fila por relación auditor↔cliente
--      para queries rápidas de "mis clientes" sin JOINs multinivel.
--   3. Crea budget_access_log — registro de accesos del auditor al
--      budget del cliente para transparencia y revocación.
--
-- La infraestructura existente (budget_members + budget_invitations
-- + RLS helpers is_budget_member + current_member_role) ya soporta
-- N miembros por budget. Esta migration solo agrega el cuarto rol
-- + tablas auxiliares para escalabilidad y privacidad.
--
-- Run once en Supabase SQL Editor. Idempotente.
-- ============================================================

-- ── 1. Rol 'auditor' en budget_members y budget_invitations ──
--
-- Las check constraints existentes solo permiten owner/editor/
-- viewer. Las recreamos incluyendo 'auditor'. Drop-then-create para
-- que la migration sea re-ejecutable sin error.

alter table budget_members drop constraint if exists budget_members_role_check;
alter table budget_members add constraint budget_members_role_check
  check (role in ('owner', 'editor', 'viewer', 'auditor'));

alter table budget_invitations drop constraint if exists budget_invitations_role_check;
alter table budget_invitations add constraint budget_invitations_role_check
  check (role in ('owner', 'editor', 'viewer', 'auditor'));

-- ── 2. agency_relationships ──────────────────────────────────
--
-- Mantiene fila por relación auditor↔cliente. Redundante con
-- budget_members (un auditor con role='auditor' implica la relación),
-- pero esta tabla permite:
--   • Listar "clientes de X auditor" en una query indexada sin JOIN
--     multinivel
--   • Guardar client_label que solo el auditor controla (no el cliente)
--   • Pausar/terminar la relación sin perder la fila histórica

create table if not exists agency_relationships (
  id                 uuid primary key default gen_random_uuid(),
  auditor_user_id    uuid references auth.users on delete cascade not null,
  client_user_id     uuid references auth.users on delete cascade not null,
  client_budget_id   uuid references budgets on delete cascade not null,
  -- Nombre comercial del cliente — útil cuando el auditor maneja
  -- ej. "Restaurante Don Pepe" vs el nombre técnico del budget.
  client_label       text,
  status             text not null default 'active'
                       check (status in ('active', 'paused', 'ended')),
  created_at         timestamptz default now(),
  -- Un auditor solo puede tener una relación activa con un budget
  -- específico. Si se "termina" se mantiene el row con status='ended'.
  unique(auditor_user_id, client_budget_id)
);

-- Index parcial — solo necesitamos lookups rápidos de relaciones
-- activas. Las pausadas/terminadas se leen rara vez.
create index if not exists agency_relationships_auditor_idx
  on agency_relationships(auditor_user_id) where status = 'active';
create index if not exists agency_relationships_client_idx
  on agency_relationships(client_user_id);

alter table agency_relationships enable row level security;

drop policy if exists "ar_select" on agency_relationships;
create policy "ar_select"
  on agency_relationships for select
  using (auditor_user_id = auth.uid() or client_user_id = auth.uid());

-- El auditor puede crear/actualizar/borrar sus propias relaciones.
-- El cliente solo puede leer (no manipular).
drop policy if exists "ar_manage_by_auditor" on agency_relationships;
create policy "ar_manage_by_auditor"
  on agency_relationships for all
  using (auditor_user_id = auth.uid())
  with check (auditor_user_id = auth.uid());

-- ── 3. budget_access_log ────────────────────────────────────
--
-- Log append-only de accesos al budget. Sirve para:
--   • Cliente ve "tu auditor accedió hace 3 horas"
--   • Auditor puede demostrar trazabilidad ante un cliente o tercero
--   • Forensics si hay disputa de acceso
--
-- Insert via server actions (con debounce de 5min en Layout para no
-- inflar). Solo se loggea cuando actor != owner del budget — los
-- accesos del propio dueño no son auditables aquí.

create table if not exists budget_access_log (
  id              bigserial primary key,
  budget_id       uuid references budgets on delete cascade not null,
  actor_user_id   uuid references auth.users on delete set null,
  action          text not null,  -- 'viewed' | 'exported' | 'edited' (futuro)
  created_at      timestamptz default now()
);

create index if not exists budget_access_log_budget_idx
  on budget_access_log(budget_id, created_at desc);
create index if not exists budget_access_log_actor_idx
  on budget_access_log(actor_user_id, created_at desc);

alter table budget_access_log enable row level security;

-- Cualquier miembro del budget puede leer el log (auditor lo lee
-- para verse a sí mismo; cliente lo lee para auditar al auditor).
drop policy if exists "bal_select" on budget_access_log;
create policy "bal_select"
  on budget_access_log for select
  using (is_budget_member(budget_id));

-- Inserts solo desde server-side (Server Actions). Los Server Actions
-- usan el cliente regular del usuario autenticado, así que esta policy
-- de INSERT permite logging propio (actor = auth.uid()).
drop policy if exists "bal_insert_self" on budget_access_log;
create policy "bal_insert_self"
  on budget_access_log for insert
  with check (actor_user_id = auth.uid() and is_budget_member(budget_id));

-- ── 4. Auditor es read-only en transacciones/categorías ────
--
-- Las policies existentes de UPDATE/DELETE/INSERT en transactions,
-- categories, monthly_assignments usan current_member_role(bid) in
-- ('owner', 'editor'). El nuevo rol 'auditor' queda automáticamente
-- excluido — no requiere cambio en policies existentes.
--
-- Si en el futuro queremos endurecer (ej. prohibir que un auditor
-- siquiera intente UPDATE), la check sigue siendo "in ('owner',
-- 'editor')" — 'auditor' nunca entra. Esto es por diseño: defense in
-- depth + RLS hace el rechazo sin código.
--
-- No-op aquí pero documentado: agregar 'auditor' a otras policies
-- requeriría revisar TODA la cadena (categories, transactions,
-- monthly_assignments, accounts, subtransactions, etc.). Mantener
-- read-only es lo esperado para el rol.
