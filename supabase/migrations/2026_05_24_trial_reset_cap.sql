-- ============================================================
-- Migration: cap de trial resets para prevenir trial infinito
-- 2026-05-24
--
-- Contexto: el commit 87cd90b hizo que resetOnboarding() refresque
-- trial_ends_at a 90 días. SIN un cap, un usuario podía clickear
-- "Rehacer onboarding" cada 89 días y nunca pagar — la auditoría de
-- seguridad lo flaggeó como crítico (bypass de billing).
--
-- Esta migration:
--   1. Añade trial_reset_count para trackear cuántas veces el usuario
--      ha pedido reset (default 0).
--   2. El cap se enforce en TS dentro de resetOnboarding (1 reset
--      total para users on trial; users Pro nunca pierden plan).
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists trial_reset_count integer not null default 0;
