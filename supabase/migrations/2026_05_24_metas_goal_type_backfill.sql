-- ============================================================
-- Migration: backfill goal_type='savings_balance' a categorías del grupo "Metas"
-- 2026-05-24
--
-- Contexto:
-- En el onboarding original, categorías del grupo "Metas" (Fondo de
-- emergencia, Vacaciones, Carro nuevo, etc.) se creaban sin goal_type,
-- así que aparecían como categorías regulares en /app/plan y NO
-- aparecían en /app/metas. Ahora /app/metas las muestra como
-- "configurar meta" si están en ese grupo, y /app/plan las esconde.
--
-- Para que el comportamiento sea consistente con futuros signups (que
-- ya reciben goal_type desde el insert del onboarding), backfill las
-- existentes que no tienen goal_type todavía.
--
-- Solo toca categorías que:
--   - están en un grupo llamado exactamente "Metas"
--   - no tienen goal_type ya seteado (idempotente)
--   - no tienen goal_amount > 0 (ese caso ya está bien — el user lo
--     configuró manualmente)
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

update public.categories c
   set goal_type = 'savings_balance'
  from public.category_groups g
 where c.group_id = g.id
   and g.name = 'Metas'
   and c.goal_type is null
   and (c.goal_amount is null or c.goal_amount = 0);
