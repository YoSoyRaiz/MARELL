-- ============================================================
-- Migration: notification preferences + dedupe tracking
-- 2026-04-30
--
-- Adds two columns to profiles:
--   email_notifications (bool, default true) — user preference
--   notifications_last_seen (timestamptz)    — bookkeeping for the daily
--                                              notifications cron so we
--                                              don't email the same
--                                              upcoming-scheduled twice.
--
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table profiles
  add column if not exists email_notifications boolean not null default true;

alter table profiles
  add column if not exists notifications_last_seen timestamptz;
