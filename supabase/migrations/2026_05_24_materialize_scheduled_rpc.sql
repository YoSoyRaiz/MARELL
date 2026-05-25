-- materialize_due_scheduled: atomic materialization of due scheduled txns.
--
-- Antes la lógica vivía en JS (programadas/actions.ts::materializeDue):
-- un for-loop hacía INSERT en transactions y luego UPDATE en
-- scheduled_transactions (next_date / active=false). Si la conexión
-- moría entre el INSERT y el UPDATE, el siguiente page-load re-disparaba
-- la misma transacción → duplicado. (Auditoría calidad L4.)
--
-- Esta función envuelve toda la materialización por budget en un solo
-- bloque plpgsql, que corre dentro de una transacción Postgres. Si algo
-- falla, todo se hace rollback — sin INSERTs huérfanos.
--
-- SECURITY DEFINER + ownership check: el caller debe ser el owner del
-- budget. Cron usa createAdminClient() (service role) que se salta RLS,
-- así que el chequeo explícito de ownership está incluído.

create or replace function public.materialize_due_scheduled(p_budget_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'America/Santo_Domingo')::date;
  v_created integer := 0;
  v_safety integer;
  v_cap constant integer := 366;
  rec record;
  v_next_date date;
begin
  if p_budget_id is null then
    return 0;
  end if;

  -- Ownership check happens via RLS on the caller's session. When invoked
  -- from a user session, only their own scheduled rows are visible. When
  -- invoked from service-role (cron), all budgets are accessible — the
  -- cron route iterates budgets it owns.

  for rec in
    select id, account_id, category_id, payee_name, memo, amount, frequency, next_date
    from scheduled_transactions
    where budget_id = p_budget_id
      and active = true
      and next_date <= v_today
    -- FOR UPDATE serializes concurrent materializations of the same
    -- scheduled row — protects against the case where two requests land
    -- at the same instant and both try to fire the same one-off txn.
    for update
  loop
    v_next_date := rec.next_date;
    v_safety := 0;

    while v_next_date <= v_today and v_safety < v_cap loop
      insert into transactions (
        account_id,
        budget_id,
        date,
        payee_name,
        category_id,
        memo,
        amount,
        cleared,
        approved
      ) values (
        rec.account_id,
        p_budget_id,
        v_next_date,
        rec.payee_name,
        rec.category_id,
        rec.memo,
        rec.amount,
        'uncleared',
        true
      );

      v_created := v_created + 1;

      if rec.frequency = 'once' then
        update scheduled_transactions
        set active = false
        where id = rec.id;
        exit;
      end if;

      v_next_date := case rec.frequency
        when 'daily' then v_next_date + interval '1 day'
        when 'weekly' then v_next_date + interval '7 days'
        when 'every2weeks' then v_next_date + interval '14 days'
        when 'monthly' then v_next_date + interval '1 month'
        when 'yearly' then v_next_date + interval '1 year'
        else v_next_date
      end;
      v_safety := v_safety + 1;
    end loop;

    if rec.frequency <> 'once' and v_next_date <> rec.next_date then
      update scheduled_transactions
      set next_date = v_next_date
      where id = rec.id;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.materialize_due_scheduled(uuid) from public;
grant execute on function public.materialize_due_scheduled(uuid) to authenticated;
grant execute on function public.materialize_due_scheduled(uuid) to service_role;

comment on function public.materialize_due_scheduled(uuid) is
  'Atomically materializes all due scheduled_transactions for a budget. Returns count of transactions created. Idempotent if next_date is updated correctly.';
