-- ============================================================
-- Migration: web push subscriptions
-- 2026-05-08
--
-- Stores the WebPush PushSubscription per user so the daily
-- notifications cron (and one-off events like "tu trial vence
-- mañana") can deliver native push to whoever has the PWA / native
-- app installed.
--
-- Each user can have multiple subscriptions (one per device). The
-- endpoint is unique per device so we use it as the dedupe key.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz default now(),
  last_seen_at    timestamptz default now()
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "owner_manage_subscriptions" on push_subscriptions;
create policy "owner_manage_subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
