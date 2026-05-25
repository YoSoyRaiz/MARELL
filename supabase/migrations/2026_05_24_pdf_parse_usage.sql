-- ============================================================
-- Migration: per-user monthly PDF parse usage tracking
-- 2026-05-24
--
-- Misma forma que receipt_ocr_usage, pero para /api/transactions/parse-pdf
-- (Claude Haiku 4.5 leyendo estados de cuenta bancarios). Caps mensuales:
-- free → 0, trial → 5, pro → 20. La auditoría de seguridad encontró que
-- el endpoint estaba completamente sin protección, exponiéndonos a un
-- ataque de quemado de cuota Anthropic ($3,500+/hora factible).
--
-- Una fila por (user, YYYY-MM). El próximo mes se resetea solo porque
-- la clave cambia — sin cron, sin cleanup.
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

create table if not exists pdf_parse_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  year_month  text not null,                 -- 'YYYY-MM'
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, year_month)
);

alter table pdf_parse_usage enable row level security;

-- Users ven solo su propia fila (para que la UI pueda mostrar "X/N").
drop policy if exists "pdf_usage_owner_select" on pdf_parse_usage;
create policy "pdf_usage_owner_select"
  on pdf_parse_usage for select
  using (user_id = auth.uid());

-- Plan-to-cap mapping. Hardcoded en SQL para que el cliente no pueda
-- mentir sobre su plan al llamar la función directamente.
create or replace function _pdf_parse_limit_for(p_plan text)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'pro'   then 20
    when p_plan = 'trial' then 5
    else                       0   -- free / null / desconocido = sin acceso
  end;
$$;

-- Atomic check-and-increment, mismo patrón que increment_ocr_usage.
-- El lookup del plan pasa server-side para que el cliente no pueda
-- inflar su límite.
create or replace function increment_pdf_parse_usage()
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_ym    text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_plan  text;
  v_limit integer;
  v_count integer;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select plan into v_plan from profiles where id = v_user;
  v_limit := _pdf_parse_limit_for(v_plan);

  if v_limit = 0 then
    return query select false, 0, 0;
    return;
  end if;

  -- Upsert con row lock para serializar llamadas concurrentes del mismo
  -- usuario (evita race condition).
  insert into pdf_parse_usage (user_id, year_month, count)
  values (v_user, v_ym, 0)
  on conflict (user_id, year_month) do update
    set updated_at = pdf_parse_usage.updated_at
  returning count into v_count;

  if v_count >= v_limit then
    return query select false, v_count, v_limit;
    return;
  end if;

  update pdf_parse_usage
     set count = count + 1,
         updated_at = now()
   where user_id = v_user
     and year_month = v_ym
  returning count into v_count;

  return query select true, v_count, v_limit;
end;
$$;

grant execute on function increment_pdf_parse_usage() to authenticated;

-- Refund de un slot si la llamada upstream falla después de incrementar.
create or replace function decrement_pdf_parse_usage()
returns void
language sql
security definer
set search_path = public
as $$
  update pdf_parse_usage
     set count = greatest(count - 1, 0),
         updated_at = now()
   where user_id = auth.uid()
     and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM');
$$;

grant execute on function decrement_pdf_parse_usage() to authenticated;

-- Read-only helper para la UI: "cuántos PDFs me quedan?"
create or replace function get_pdf_parse_usage()
returns table(used integer, year_month text)
language sql
security definer
set search_path = public
as $$
  select coalesce(count, 0) as used,
         coalesce(year_month, to_char(now() at time zone 'UTC', 'YYYY-MM')) as year_month
    from pdf_parse_usage
   where user_id = auth.uid()
     and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM')
   union all
  select 0, to_char(now() at time zone 'UTC', 'YYYY-MM')
   where not exists (
     select 1 from pdf_parse_usage
      where user_id = auth.uid()
        and year_month = to_char(now() at time zone 'UTC', 'YYYY-MM')
   )
   limit 1;
$$;

grant execute on function get_pdf_parse_usage() to authenticated;
