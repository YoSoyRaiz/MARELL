-- ============================================================
-- Migration: endurece bucket `receipts` con restricciones server-side
-- 2026-05-24
--
-- Contexto: la auditoría de seguridad (A2/A3) encontró que el bucket
-- aceptaba CUALQUIER tipo de archivo y CUALQUIER tamaño. El cliente
-- valida pero un user malicioso puede saltar esa validación llamando
-- directamente al endpoint de upload.
--
-- Esta migration restringe:
--   - file_size_limit a 5 MB (5,242,880 bytes)
--   - allowed_mime_types a image/jpeg, image/png, image/webp, image/gif
--
-- Estas reglas se enforce a nivel de Supabase Storage, antes de que el
-- byte llegue al bucket.
--
-- IMPORTANTE: requiere que el bucket ya exista. Crear primero en el
-- dashboard (Storage > New bucket > "receipts" > Private). Después
-- aplicar esta migration.
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

update storage.buckets
   set file_size_limit = 5242880,  -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'receipts';
