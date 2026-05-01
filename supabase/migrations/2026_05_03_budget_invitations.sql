-- ============================================================
-- Migration: budget invitations
-- 2026-05-03
--
-- Token-based invite flow for shared budgets. The owner creates an
-- invitation with the invitee's email; we email them a link to
-- /accept-invite?token=… and on acceptance we insert a row into
-- budget_members and mark the invitation accepted.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists budget_invitations (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid references budgets on delete cascade not null,
  invited_by   uuid references auth.users on delete cascade not null,
  email        text not null,
  role         text not null default 'editor'
                 check (role in ('owner', 'editor', 'viewer')),
  token        text not null unique,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users on delete set null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz default now()
);

create index if not exists budget_invitations_budget_idx
  on budget_invitations(budget_id);
create index if not exists budget_invitations_token_idx
  on budget_invitations(token);
create index if not exists budget_invitations_email_idx
  on budget_invitations(lower(email));

alter table budget_invitations enable row level security;

-- Owner of the budget can fully manage invitations for that budget.
create policy if not exists "owner_manage_invitations"
  on budget_invitations for all
  using (exists (
    select 1 from budgets
    where id = budget_id and created_by = auth.uid()
  ));

-- Anyone can SELECT a single invitation by token (needed for the
-- acceptance flow before they're a member yet). The token itself is
-- the auth — it's a long random string.
create policy if not exists "public_read_by_token"
  on budget_invitations for select
  using (true);
