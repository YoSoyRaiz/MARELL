-- ============================================================
-- Migration: receipt photos for transactions
-- 2026-05-07
--
-- Adds an optional `receipt_url` to transactions that points at a
-- file in the `receipts` storage bucket. The bucket is private —
-- access is granted per-user via the RLS policy below.
--
-- This unblocks the mobile flow where the user taps the camera icon,
-- snaps a picture of the receipt, and we upload it alongside the
-- transaction.
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

alter table transactions
  add column if not exists receipt_url text,
  add column if not exists receipt_path text; -- key inside the bucket
                                              -- so we can delete on
                                              -- transaction delete.

-- Storage bucket — created via Supabase dashboard or via the
-- supabase.storage SDK. The SQL below documents the policy expected
-- on it. If the bucket doesn't exist yet, create it in:
--   https://supabase.com/dashboard/project/<id>/storage/buckets
-- with name = 'receipts' and Public access = OFF.

-- Storage policies live in storage.objects. We allow:
--   1. INSERT/SELECT/DELETE only on objects whose path starts with
--      the user's auth uid (so each user owns their own folder).
--   2. The owner can manage their objects; nobody else can.
-- These policies are idempotent (drop + create).

drop policy if exists "receipts_owner_select" on storage.objects;
create policy "receipts_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_owner_delete" on storage.objects;
create policy "receipts_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
