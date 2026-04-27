-- ============================================================
-- MARELL — Schema completo v1.0
-- Ejecutar en Supabase SQL Editor (nuevo proyecto)
-- Idempotente: se puede correr múltiples veces sin error.
-- ============================================================

-- ── RESET: borra todo si existe (orden inverso por FK) ──────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop function if exists is_budget_member(uuid) cascade;
drop function if exists create_default_categories(uuid) cascade;

drop table if exists subtransactions cascade;
drop table if exists scheduled_transactions cascade;
drop table if exists transactions cascade;
drop table if exists payees cascade;
drop table if exists monthly_assignments cascade;
drop table if exists categories cascade;
drop table if exists category_groups cascade;
drop table if exists accounts cascade;
drop table if exists budget_members cascade;
drop table if exists budgets cascade;
drop table if exists profiles cascade;

-- ── 1. PRESUPUESTOS ──────────────────────────────────────────
create table budgets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'DOP', -- DOP | USD
  created_by  uuid references auth.users not null,
  created_at  timestamptz default now()
);

-- ── 2. MIEMBROS DEL PRESUPUESTO (presupuesto compartido) ─────
create table budget_members (
  id         uuid primary key default gen_random_uuid(),
  budget_id  uuid references budgets on delete cascade,
  user_id    uuid references auth.users,
  role       text not null default 'editor', -- owner | editor | viewer
  joined_at  timestamptz default now(),
  unique(budget_id, user_id)
);

-- ── 3. CUENTAS ───────────────────────────────────────────────
create table accounts (
  id                uuid primary key default gen_random_uuid(),
  budget_id         uuid references budgets on delete cascade,
  name              text not null,
  type              text not null,
  -- checking | savings | credit_card | cash | investment | mortgage | other
  currency          text not null default 'DOP',
  balance           numeric(14,2) not null default 0,
  credit_limit      numeric(14,2),          -- solo para credit_card
  is_budget_account boolean default true,   -- false = solo tracking (inversiones)
  closed            boolean default false,
  sort_order        int default 0,
  note              text,
  created_at        timestamptz default now()
);

-- ── 4. GRUPOS DE CATEGORÍAS ──────────────────────────────────
create table category_groups (
  id         uuid primary key default gen_random_uuid(),
  budget_id  uuid references budgets on delete cascade,
  name       text not null,
  is_system  boolean default false, -- true = auto-creado (ej. Credit Card Payments)
  sort_order int default 0,
  collapsed  boolean default false
);

-- ── 5. CATEGORÍAS ────────────────────────────────────────────
create table categories (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid references category_groups on delete cascade,
  budget_id      uuid references budgets on delete cascade,
  name           text not null,
  is_system      boolean default false,
  sort_order     int default 0,
  hidden         boolean default false,
  -- Metas
  goal_type      text,
  -- savings_balance | savings_builder | monthly_spending | needed_by | debt_payoff
  goal_amount    numeric(14,2),
  goal_date      date,
  goal_monthly   numeric(14,2),
  note           text,
  created_at     timestamptz default now()
);

-- ── 6. ASIGNACIONES MENSUALES ────────────────────────────────
create table monthly_assignments (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid references budgets on delete cascade,
  category_id  uuid references categories on delete cascade,
  month        text not null, -- formato: '2026-04'
  assigned     numeric(14,2) not null default 0,
  note         text,
  unique(category_id, month)
);

-- ── 7. COMERCIOS / PAYEES ────────────────────────────────────
create table payees (
  id                  uuid primary key default gen_random_uuid(),
  budget_id           uuid references budgets on delete cascade,
  name                text not null,
  default_category_id uuid references categories on delete set null,
  created_at          timestamptz default now()
);

-- ── 8. TRANSACCIONES ─────────────────────────────────────────
create table transactions (
  id                       uuid primary key default gen_random_uuid(),
  account_id               uuid references accounts on delete cascade,
  budget_id                uuid references budgets on delete cascade,
  date                     date not null,
  payee_id                 uuid references payees on delete set null,
  payee_name               text,
  category_id              uuid references categories on delete set null,
  memo                     text,
  amount                   numeric(14,2) not null, -- + ingreso / - gasto
  cleared                  text default 'uncleared', -- uncleared | cleared | reconciled
  approved                 boolean default true,
  is_split                 boolean default false,
  transfer_account_id      uuid references accounts on delete set null,
  transfer_transaction_id  uuid references transactions on delete set null,
  scheduled_transaction_id uuid,
  import_id                text unique, -- evita duplicados en CSV/PDF import
  created_at               timestamptz default now()
);

-- ── 8b. SUBTRANSACCIONES (splits) ────────────────────────────
create table subtransactions (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions on delete cascade,
  category_id    uuid references categories on delete set null,
  payee_id       uuid references payees on delete set null,
  memo           text,
  amount         numeric(14,2) not null
);

-- ── 9. TRANSACCIONES PROGRAMADAS ─────────────────────────────
create table scheduled_transactions (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid references budgets on delete cascade,
  account_id   uuid references accounts on delete cascade,
  payee_id     uuid references payees on delete set null,
  payee_name   text,
  category_id  uuid references categories on delete set null,
  memo         text,
  amount       numeric(14,2),
  frequency    text not null,
  -- once | daily | weekly | every2weeks | monthly | yearly
  next_date    date not null,
  is_split     boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── 10. PERFILES DE USUARIO ──────────────────────────────────
create table profiles (
  id             uuid primary key references auth.users on delete cascade,
  display_name   text,
  plan           text not null default 'trial', -- trial | free | pro
  trial_ends_at  timestamptz,
  pro_expires_at timestamptz,
  approved       boolean default false,
  onboarded      boolean default false, -- completó el onboarding
  avatar_url     text,
  updated_at     timestamptz default now()
);

-- Auto-crear perfil al registrarse
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table budgets               enable row level security;
alter table budget_members        enable row level security;
alter table accounts              enable row level security;
alter table category_groups       enable row level security;
alter table categories            enable row level security;
alter table monthly_assignments   enable row level security;
alter table payees                enable row level security;
alter table transactions          enable row level security;
alter table subtransactions       enable row level security;
alter table scheduled_transactions enable row level security;
alter table profiles              enable row level security;

-- Función helper: verifica si el usuario es miembro del presupuesto
create or replace function is_budget_member(bid uuid)
returns boolean as $$
  select exists (
    select 1 from budget_members
    where budget_id = bid and user_id = auth.uid()
  );
$$ language sql security definer;

-- Budgets
create policy "member_select" on budgets for select
  using (is_budget_member(id) or created_by = auth.uid());
create policy "owner_insert" on budgets for insert
  with check (created_by = auth.uid());
create policy "owner_update" on budgets for update
  using (created_by = auth.uid());
create policy "owner_delete" on budgets for delete
  using (created_by = auth.uid());

-- Budget members
create policy "member_select" on budget_members for select
  using (is_budget_member(budget_id) or user_id = auth.uid());
create policy "owner_manage" on budget_members for all
  using (exists (
    select 1 from budgets where id = budget_id and created_by = auth.uid()
  ));

-- Todas las demás tablas: acceso si eres miembro del presupuesto
create policy "member_all" on accounts for all
  using (is_budget_member(budget_id));
create policy "member_all" on category_groups for all
  using (is_budget_member(budget_id));
create policy "member_all" on categories for all
  using (is_budget_member(budget_id));
create policy "member_all" on monthly_assignments for all
  using (is_budget_member(budget_id));
create policy "member_all" on payees for all
  using (is_budget_member(budget_id));
create policy "member_all" on transactions for all
  using (is_budget_member(budget_id));
create policy "member_all" on scheduled_transactions for all
  using (is_budget_member(budget_id));

-- Subtransactions: hereda via transaction
create policy "member_all" on subtransactions for all
  using (exists (
    select 1 from transactions t
    where t.id = transaction_id and is_budget_member(t.budget_id)
  ));

-- Perfil: solo el propio usuario
create policy "own_profile" on profiles for all
  using (id = auth.uid());


-- ============================================================
-- CATEGORÍAS DEFAULT (estilo YNAB, adaptadas para RD)
-- Se insertan al crear el primer presupuesto vía función
-- ============================================================

create or replace function create_default_categories(p_budget_id uuid)
returns void as $$
declare
  g_id uuid;
begin

  -- ── OBLIGACIONES INMEDIATAS ──────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Obligaciones Inmediatas', 1)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Renta / Hipoteca',          1),
    (g_id, p_budget_id, 'Electricidad (EDENORTE/EDESUR)', 2),
    (g_id, p_budget_id, 'Agua (CAASD)',               3),
    (g_id, p_budget_id, 'Internet',                   4),
    (g_id, p_budget_id, 'Teléfono móvil',             5),
    (g_id, p_budget_id, 'Supermercado / Colmado',     6),
    (g_id, p_budget_id, 'Gasolina / Transporte',      7),
    (g_id, p_budget_id, 'Cargos e intereses',         8);

  -- ── GASTOS VERDADEROS ────────────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Gastos Verdaderos', 2)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Mantenimiento del vehículo', 1),
    (g_id, p_budget_id, 'Mantenimiento del hogar',    2),
    (g_id, p_budget_id, 'Seguro médico / ARS',        3),
    (g_id, p_budget_id, 'Seguro del vehículo',        4),
    (g_id, p_budget_id, 'Seguro de vida',             5),
    (g_id, p_budget_id, 'Ropa y calzado',             6),
    (g_id, p_budget_id, 'Regalos y celebraciones',    7),
    (g_id, p_budget_id, 'Navidad / Año Nuevo',        8),
    (g_id, p_budget_id, 'Vacaciones',                 9),
    (g_id, p_budget_id, 'Electrónica / Tecnología',   10),
    (g_id, p_budget_id, 'Suscripciones digitales',    11),
    (g_id, p_budget_id, 'Educación / Cursos',         12),
    (g_id, p_budget_id, 'Médico / Farmacia',          13);

  -- ── PAGOS DE DEUDAS ──────────────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Pagos de Deudas', 3)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Préstamo personal',   1),
    (g_id, p_budget_id, 'Préstamo vehicular',  2),
    (g_id, p_budget_id, 'Préstamo estudiantil',3),
    (g_id, p_budget_id, 'Tarjeta de crédito',  4);

  -- ── CALIDAD DE VIDA ──────────────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Calidad de Vida', 4)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Restaurantes y salidas', 1),
    (g_id, p_budget_id, 'Entretenimiento',         2),
    (g_id, p_budget_id, 'Cuidado personal',        3),
    (g_id, p_budget_id, 'Gimnasio / Deporte',      4),
    (g_id, p_budget_id, 'Hobbies',                 5),
    (g_id, p_budget_id, 'Mascotas',                6),
    (g_id, p_budget_id, 'Donaciones / Diezmo',     7);

  -- ── SOLO POR DIVERSIÓN ───────────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Solo por Diversión', 5)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Dinero personal',             1),
    (g_id, p_budget_id, 'Streaming (Netflix, Disney+)', 2),
    (g_id, p_budget_id, 'Música / Spotify',             3),
    (g_id, p_budget_id, 'Videojuegos',                  4),
    (g_id, p_budget_id, 'Libros / Revistas',            5);

  -- ── METAS DE AHORRO ──────────────────────────────────────
  insert into category_groups (id, budget_id, name, sort_order)
  values (gen_random_uuid(), p_budget_id, 'Metas de Ahorro', 6)
  returning id into g_id;

  insert into categories (group_id, budget_id, name, sort_order) values
    (g_id, p_budget_id, 'Fondo de Emergencia',    1),
    (g_id, p_budget_id, 'Reemplazo de vehículo',  2),
    (g_id, p_budget_id, 'Prima / Inicial de casa', 3),
    (g_id, p_budget_id, 'Retiro / Pensión',        4),
    (g_id, p_budget_id, 'Viaje / Vacaciones',      5),
    (g_id, p_budget_id, 'Fondo escolar',           6),
    (g_id, p_budget_id, 'Inversión',               7);

end;
$$ language plpgsql;
