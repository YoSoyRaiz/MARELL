-- ============================================================
-- Migration: dar permisos de escritura al rol 'auditor'
-- 2026-06-03
--
-- Contexto: la v2 (2026_05_28_multi_budget_auditor.sql) definió el rol
-- 'auditor' como READ-ONLY por diseño, asumiendo un contador que solo
-- audita lectura. Pero el uso real del Auditor Financiero en MARELL es
-- de "asesor personal activo": crea cuentas, agrega categorías, edita
-- txns importadas. La restricción read-only es fricción innecesaria.
--
-- Esta migration extiende las policies de escritura para incluir
-- 'auditor' junto a 'owner' y 'editor' en:
--   - accounts (insert / update / delete)
--   - transactions (insert / update / delete)
--   - categories + category_groups (all)
--   - monthly_assignments (insert / update / delete)
--   - scheduled_transactions (all)
--   - payees (all)
--   - subtransactions (all)
--
-- NO se extiende a:
--   - budget_members (auditor no debe invitar/remover otros miembros)
--   - budgets (no debe renombrar/eliminar el budget en sí)
--   - goals: revisar manualmente si tienen RLS y agregar 'auditor' si aplica
--
-- Defense in depth: el access_log de v2 sigue registrando todo lo que
-- el auditor toca, así que mantenemos trazabilidad aunque ahora pueda
-- escribir.
--
-- Idempotente: drop + create de las policies relevantes.
-- ============================================================

-- Helper nuevo: roles con write access. Si en el futuro agregamos un
-- rol más (ej. 'manager'), solo editamos esta función — no todas las
-- policies de toda la app.
create or replace function public.can_write_budget(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('owner', 'editor', 'auditor')
       from budget_members
      where budget_id = bid and user_id = auth.uid()
      limit 1),
    false
  )
$$;

revoke all on function public.can_write_budget(uuid) from public;
grant execute on function public.can_write_budget(uuid) to authenticated;


-- ── accounts ──────────────────────────────────────────────────
drop policy if exists "member_write" on accounts;
drop policy if exists "member_update" on accounts;
drop policy if exists "member_delete" on accounts;

create policy "member_write" on accounts for insert
  with check (public.can_write_budget(budget_id));
create policy "member_update" on accounts for update
  using (public.can_write_budget(budget_id));
create policy "member_delete" on accounts for delete
  using (public.can_write_budget(budget_id));


-- ── transactions ──────────────────────────────────────────────
drop policy if exists "member_write" on transactions;
drop policy if exists "member_update" on transactions;
drop policy if exists "member_delete" on transactions;

create policy "member_write" on transactions for insert
  with check (public.can_write_budget(budget_id));
create policy "member_update" on transactions for update
  using (public.can_write_budget(budget_id));
create policy "member_delete" on transactions for delete
  using (public.can_write_budget(budget_id));


-- ── monthly_assignments ───────────────────────────────────────
drop policy if exists "member_write" on monthly_assignments;
drop policy if exists "member_update" on monthly_assignments;
drop policy if exists "member_delete" on monthly_assignments;

create policy "member_write" on monthly_assignments for insert
  with check (public.can_write_budget(budget_id));
create policy "member_update" on monthly_assignments for update
  using (public.can_write_budget(budget_id));
create policy "member_delete" on monthly_assignments for delete
  using (public.can_write_budget(budget_id));


-- ── categories ────────────────────────────────────────────────
drop policy if exists "member_write" on categories;

create policy "member_write" on categories for all
  using (public.can_write_budget(budget_id))
  with check (public.can_write_budget(budget_id));


-- ── category_groups ───────────────────────────────────────────
drop policy if exists "member_write" on category_groups;

create policy "member_write" on category_groups for all
  using (public.can_write_budget(budget_id))
  with check (public.can_write_budget(budget_id));


-- ── scheduled_transactions ────────────────────────────────────
drop policy if exists "member_write" on scheduled_transactions;

create policy "member_write" on scheduled_transactions for all
  using (public.can_write_budget(budget_id))
  with check (public.can_write_budget(budget_id));


-- ── payees ────────────────────────────────────────────────────
drop policy if exists "member_write" on payees;

create policy "member_write" on payees for all
  using (public.can_write_budget(budget_id))
  with check (public.can_write_budget(budget_id));


-- ── subtransactions ───────────────────────────────────────────
-- Esta tabla referencia transactions; el check de role se hace contra
-- el parent transaction's budget_id.
drop policy if exists "member_write" on subtransactions;

create policy "member_write" on subtransactions for all
  using (exists (
    select 1 from transactions t
    where t.id = transaction_id
      and public.can_write_budget(t.budget_id)
  ))
  with check (exists (
    select 1 from transactions t
    where t.id = transaction_id
      and public.can_write_budget(t.budget_id)
  ));


-- ── goals (si existen con member-role policies) ───────────────
-- Algunas instalaciones tienen tabla goals con policies similares.
-- Drop + recreate si la tabla existe. Ignora si no.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'goals') then
    execute 'drop policy if exists "member_write" on goals';
    execute $POLICY$
      create policy "member_write" on goals for all
        using (public.can_write_budget(budget_id))
        with check (public.can_write_budget(budget_id))
    $POLICY$;
  end if;
end $$;
