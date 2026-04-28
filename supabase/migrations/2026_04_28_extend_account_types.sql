-- ============================================================
-- Migration: extend accounts.type to support all 13 wizard types
-- 2026-04-28
--
-- Run once in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Drop the old check constraint if it exists (in case a previous
-- migration added a stricter one).
alter table accounts drop constraint if exists accounts_type_check;

-- Add the new constraint with the full set of valid types,
-- including legacy values to preserve old onboarding data.
alter table accounts add constraint accounts_type_check
  check (type in (
    -- Efectivo
    'checking', 'savings', 'cash',
    -- Crédito
    'credit_card', 'line_of_credit',
    -- Hipotecas y préstamos
    'mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'medical_debt', 'other_debt',
    -- Seguimiento
    'asset', 'liability',
    -- Legacy
    'investment', 'other'
  ));
