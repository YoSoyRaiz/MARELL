-- ============================================================
-- Migration: subscription / billing fields on profiles
-- 2026-05-02
--
-- Adds the columns we need to track subscriptions across two
-- providers (Azul and PayPal). The existing `plan` and
-- `pro_expires_at` columns stay; this layer adds *who* is paying
-- and *what* their external subscription looks like so we can
-- reconcile webhooks and bill cards monthly via Azul.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

alter table profiles
  add column if not exists subscription_provider text
    check (subscription_provider in ('azul', 'paypal') or subscription_provider is null),
  add column if not exists subscription_status text
    check (subscription_status in ('active', 'past_due', 'canceled', 'trialing') or subscription_status is null),
  add column if not exists subscription_external_id text,
  add column if not exists subscription_card_token text, -- Azul tokenized card; PayPal stays null
  add column if not exists subscription_card_last4 text,
  add column if not exists subscription_card_brand text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists next_billing_at timestamptz,
  add column if not exists subscription_canceled_at timestamptz;

-- Ledger of every payment attempt (success or fail) so we have a
-- queryable history for support, refunds, and reconciliation. Keeps
-- profiles compact while letting us audit the billing pipeline.
create table if not exists payment_events (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references profiles on delete cascade,
  provider        text not null check (provider in ('azul', 'paypal')),
  external_id     text, -- Azul AzulOrderId / PayPal txn id
  amount          numeric(14, 2) not null,
  currency        text not null check (currency in ('DOP', 'USD')),
  status          text not null check (status in ('success', 'failed', 'pending', 'refunded')),
  error_message   text,
  raw_payload     jsonb, -- the full webhook body for debugging
  created_at      timestamptz default now()
);

create index if not exists payment_events_profile_idx on payment_events(profile_id);
create index if not exists payment_events_created_idx on payment_events(created_at desc);

alter table payment_events enable row level security;
-- Only the user themselves (or service role) can read their events.
create policy if not exists "self_can_read_payment_events"
  on payment_events for select
  using (auth.uid() = profile_id);
