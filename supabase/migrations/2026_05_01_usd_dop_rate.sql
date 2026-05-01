-- ============================================================
-- Migration: USD↔DOP exchange rate per budget
-- 2026-05-01
--
-- Stores the conversion rate the user wants MARELL to use when
-- mixing USD-denominated accounts into a DOP budget (or vice versa).
-- Defaulted to 60.00 — close to the BC reference. The user can
-- override it in Ajustes; they should refresh whenever the market
-- moves more than a few percent.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

alter table budgets
  add column if not exists usd_to_dop_rate numeric(8, 4) not null default 60.0000;
