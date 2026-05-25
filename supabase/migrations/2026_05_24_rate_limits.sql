-- ============================================================
-- Migration: rate limiting basado en DB (sin servicio externo)
-- 2026-05-24
--
-- Contexto: la auditoría (M7, M8) encontró que signup e
-- inviteToBudget no tenían rate limit. Un atacante podía:
--   - Quemar emails de confirmación via signup (spam relay vía Resend)
--   - Spamear emails con invitaciones desde una cuenta Pro
--
-- En vez de provisionar Upstash Redis u otro servicio externo,
-- implementamos un sliding window rate limit en Postgres. Funciona
-- perfecto para volúmenes pre-escala y se quita fácil después si
-- pasamos a Redis.
--
-- La tabla guarda un array de timestamps por (bucket, key). Cada
-- check_rate_limit() elimina los timestamps fuera de la ventana y
-- decide si la nueva acción cabe dentro del cap.
--
-- Idempotente. Run once en SQL Editor.
-- ============================================================

create table if not exists public.rate_limits (
  bucket      text not null,                          -- e.g. 'signup', 'invite'
  key         text not null,                          -- e.g. ip, email, user_id
  timestamps  bigint[] not null default array[]::bigint[],
  updated_at  timestamptz not null default now(),
  primary key (bucket, key)
);

alter table public.rate_limits enable row level security;

-- Deny-all RLS. Se usa solo desde la función SECURITY DEFINER abajo.
drop policy if exists "rate_limits_deny" on public.rate_limits;
create policy "rate_limits_deny" on public.rate_limits for all using (false);

-- Checking + recording atómico. Devuelve true si permitido, false si
-- excede el cap. Se ejecuta dentro de una transacción implícita
-- (function call) — los timestamps se filtran y agregan sin race.
--
-- Parámetros:
--   p_bucket: identificador del flow ('signup', 'invite', etc.)
--   p_key:    identificador del actor (ip, email, user_id)
--   p_max:   cuántas acciones máximo permitidas en la ventana
--   p_window_seconds: tamaño de la ventana (sliding)
create or replace function public.check_rate_limit(
  p_bucket text,
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ms       bigint := (extract(epoch from now()) * 1000)::bigint;
  v_cutoff_ms    bigint := v_now_ms - (p_window_seconds * 1000);
  v_current      bigint[];
  v_filtered     bigint[];
  v_count        integer;
begin
  -- Lee y bloquea la fila (SELECT FOR UPDATE) para serializar.
  select timestamps into v_current
    from public.rate_limits
   where bucket = p_bucket and key = p_key
   for update;

  if v_current is null then
    insert into public.rate_limits (bucket, key, timestamps)
    values (p_bucket, p_key, array[v_now_ms])
    on conflict (bucket, key) do update set
      timestamps = array_append(public.rate_limits.timestamps, v_now_ms),
      updated_at = now();
    return true;
  end if;

  -- Filtra timestamps fuera de la ventana.
  v_filtered := array(select unnest(v_current) as ts where ts >= v_cutoff_ms);
  v_count := array_length(v_filtered, 1);

  if coalesce(v_count, 0) >= p_max then
    -- Sobre el cap. Guarda los filtrados (cleanup) pero no añade.
    update public.rate_limits
       set timestamps = v_filtered,
           updated_at = now()
     where bucket = p_bucket and key = p_key;
    return false;
  end if;

  update public.rate_limits
     set timestamps = array_append(v_filtered, v_now_ms),
         updated_at = now()
   where bucket = p_bucket and key = p_key;
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer) to authenticated, anon;
