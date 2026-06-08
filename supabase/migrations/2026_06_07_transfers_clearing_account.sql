-- ============================================================
-- Migration: cuenta puente (clearing) para transferencias
-- 2026-06-07
--
-- Contexto: cuando el auditor importa estados de cuenta de bancos
-- distintos, una transferencia entre cuentas del cliente aparece en
-- AMBOS estados — una salida en el origen y una entrada en el destino.
-- Sin marcarlas, contar dos veces el ingreso o el gasto distorsiona
-- los reports.
--
-- Solución (modelo de "cuenta puente"):
--   MARELL ya tiene un modelo de transferencias usando las columnas
--   transactions.transfer_account_id + transactions.transfer_transaction_id
--   (createTransfer en src/app/app/transacciones/actions.ts).
--   Reusamos ese modelo apuntando a una cuenta especial tipo 'clearing'
--   que siempre debe estar en cero.
--
--   - Imported BHD -50K → marca como transfer al clearing
--     Resultado: BHD -50K + Clearing +50K (pair)
--   - Imported Popular +50K → marca como transfer al clearing
--     Resultado: Popular +50K + Clearing -50K (pair)
--   - Saldo Clearing = 0 (transfers se cancelaron)
--   - Net: BHD -50K, Popular +50K (correcto, sin duplicar)
--
-- Esta migration solo agrega el TIPO 'clearing' al constraint de
-- accounts.type. Los reports ya filtran `transfer_account_id is null`
-- para excluir transfers, así que no hace falta tocar lógica de
-- ingresos/gastos.
--
-- La Cuenta Puente se crea on-demand (lazy) cuando el primer transfer
-- se marca via markTransactionAsTransfer.
--
-- Idempotente.
-- ============================================================

alter table public.accounts drop constraint if exists accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in (
    -- Efectivo
    'checking', 'savings', 'cash',
    -- Crédito
    'credit_card', 'line_of_credit',
    -- Hipotecas y préstamos
    'mortgage', 'auto_loan', 'student_loan', 'personal_loan',
    'medical_debt', 'other_debt',
    -- Seguimiento
    'asset', 'liability',
    -- Puente / clearing (nuevo)
    'clearing',
    -- Legacy
    'investment', 'other'
  ));
