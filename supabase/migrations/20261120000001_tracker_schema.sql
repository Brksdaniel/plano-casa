-- DENIELS HOME TRACKER — schema próprio dentro do projeto sistema-salas.
-- Esta migração NÃO toca o schema public.

create schema if not exists tracker;

revoke all on schema tracker from public, anon;
grant usage on schema tracker to authenticated, service_role;

alter default privileges in schema tracker revoke all on tables from public, anon;
alter default privileges in schema tracker grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema tracker grant all on tables to service_role;
alter default privileges in schema tracker grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema tracker revoke execute on functions from public, anon;

-- Enums ----------------------------------------------------------------------
create type tracker.apartment_status as enum (
  'ativo', 'possivelmente_alugado', 'indisponivel', 'removido',
  'erro_acesso', 'verificacao_necessaria', 'nao_verificado'
);
create type tracker.monitor_mode as enum ('auto', 'extension', 'manual');
create type tracker.data_source as enum ('server', 'extension', 'manual');
create type tracker.confidence_level as enum ('alta', 'media', 'baixa');
create type tracker.change_kind as enum (
  'price_down', 'price_up', 'condo_change', 'iptu_change', 'status_change',
  'description_change', 'features_change', 'images_change'
);

-- Utilitário updated_at -------------------------------------------------------
create function tracker.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- profiles --------------------------------------------------------------------
create table tracker.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- user_preferences ------------------------------------------------------------
create table tracker.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_email text,
  email_enabled boolean not null default true,
  daily_digest_enabled boolean not null default true,
  daily_digest_hour smallint not null default 8 check (daily_digest_hour between 0 and 23),
  min_change_abs numeric(10,2) not null default 50,
  min_change_pct numeric(5,2) not null default 2,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on tracker.user_preferences
  for each row execute function tracker.set_updated_at();

-- apartments ------------------------------------------------------------------
create table tracker.apartments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url_original text not null check (url_original ~* '^https?://'),
  url_normalized text not null,
  platform text not null,
  external_listing_id text,
  custom_name text,
  source_title text,
  neighborhood text,
  city text,
  rent numeric(10,2) check (rent >= 0),
  condo_fee numeric(10,2) check (condo_fee >= 0),
  iptu numeric(10,2) check (iptu >= 0),
  total_monthly numeric(10,2) generated always as (coalesce(rent, 0) + coalesce(condo_fee, 0) + coalesce(iptu, 0)) stored,
  bedrooms smallint check (bedrooms >= 0),
  bathrooms smallint check (bathrooms >= 0),
  parking smallint check (parking >= 0),
  area_m2 numeric(8,2) check (area_m2 > 0),
  priority smallint not null default 3 check (priority between 1 and 5),
  notes text,
  main_image_url text,
  monitor_mode tracker.monitor_mode not null default 'manual',
  status tracker.apartment_status not null default 'nao_verificado',
  confidence tracker.confidence_level,
  last_check_at timestamptz,
  last_success_at timestamptz,
  last_source tracker.data_source,
  consecutive_failures smallint not null default 0,
  consecutive_not_found smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apartments_user_url_unique unique (user_id, url_normalized)
);
create unique index apartments_user_platform_listing_unique
  on tracker.apartments (user_id, platform, external_listing_id)
  where external_listing_id is not null;
create index apartments_user_status_idx on tracker.apartments (user_id, status);
create trigger apartments_updated_at before update on tracker.apartments
  for each row execute function tracker.set_updated_at();

-- apartment_snapshots ---------------------------------------------------------
create table tracker.apartment_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apartment_id uuid not null references tracker.apartments (id) on delete cascade,
  checked_at timestamptz not null default now(),
  source tracker.data_source not null,
  http_status smallint,
  page_kind text check (page_kind in ('listing', 'challenge', 'not_found', 'other')),
  rent numeric(10,2),
  condo_fee numeric(10,2),
  iptu numeric(10,2),
  bedrooms smallint,
  bathrooms smallint,
  parking smallint,
  area_m2 numeric(8,2),
  availability text check (availability in ('active', 'explicit_unavailable', 'unknown')),
  description_hash text,
  images_hash text,
  confidence tracker.confidence_level,
  raw jsonb,
  error text
);
create index apartment_snapshots_apt_idx on tracker.apartment_snapshots (apartment_id, checked_at desc);

-- apartment_price_history -----------------------------------------------------
create table tracker.apartment_price_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apartment_id uuid not null references tracker.apartments (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  rent numeric(10,2),
  condo_fee numeric(10,2),
  iptu numeric(10,2),
  total_monthly numeric(10,2) generated always as (coalesce(rent, 0) + coalesce(condo_fee, 0) + coalesce(iptu, 0)) stored,
  source tracker.data_source not null
);
create index apartment_price_history_apt_idx on tracker.apartment_price_history (apartment_id, recorded_at desc);

-- apartment_status_history ----------------------------------------------------
create table tracker.apartment_status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apartment_id uuid not null references tracker.apartments (id) on delete cascade,
  changed_at timestamptz not null default now(),
  from_status tracker.apartment_status,
  to_status tracker.apartment_status not null,
  evidence text,
  source tracker.data_source not null
);
create index apartment_status_history_apt_idx on tracker.apartment_status_history (apartment_id, changed_at desc);

-- apartment_changes -----------------------------------------------------------
create table tracker.apartment_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apartment_id uuid not null references tracker.apartments (id) on delete cascade,
  detected_at timestamptz not null default now(),
  kind tracker.change_kind not null,
  old_value text,
  new_value text,
  diff_abs numeric(10,2),
  diff_pct numeric(7,2),
  dedupe_key text not null unique
);
create index apartment_changes_user_idx on tracker.apartment_changes (user_id, detected_at desc);
create index apartment_changes_apt_idx on tracker.apartment_changes (apartment_id, detected_at desc);

-- notifications ---------------------------------------------------------------
create table tracker.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  apartment_id uuid references tracker.apartments (id) on delete cascade,
  change_id bigint references tracker.apartment_changes (id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  emailed_at timestamptz,
  channel_deliveries jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index notifications_user_read_idx on tracker.notifications (user_id, read_at, created_at desc);

-- monitoring_logs -------------------------------------------------------------
create table tracker.monitoring_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  run_id uuid not null,
  trigger text not null check (trigger in ('cron', 'manual', 'extension')),
  apartment_id uuid references tracker.apartments (id) on delete cascade,
  platform text,
  http_status smallint,
  outcome text not null,
  error_message text,
  duration_ms integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index monitoring_logs_started_idx on tracker.monitoring_logs (started_at desc);
create index monitoring_logs_user_idx on tracker.monitoring_logs (user_id, started_at desc);

-- Índices nas FKs restantes (advisor de performance)
create index apartment_snapshots_user_idx on tracker.apartment_snapshots (user_id);
create index apartment_price_history_user_idx on tracker.apartment_price_history (user_id);
create index apartment_status_history_user_idx on tracker.apartment_status_history (user_id);
create index notifications_apartment_idx on tracker.notifications (apartment_id);
create index notifications_change_idx on tracker.notifications (change_id);
create index monitoring_logs_apartment_idx on tracker.monitoring_logs (apartment_id);

-- RLS -------------------------------------------------------------------------
alter table tracker.profiles enable row level security;
alter table tracker.user_preferences enable row level security;
alter table tracker.apartments enable row level security;
alter table tracker.apartment_snapshots enable row level security;
alter table tracker.apartment_price_history enable row level security;
alter table tracker.apartment_status_history enable row level security;
alter table tracker.apartment_changes enable row level security;
alter table tracker.notifications enable row level security;
alter table tracker.monitoring_logs enable row level security;

create policy profiles_own on tracker.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy user_preferences_own on tracker.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apartments_own on tracker.apartments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apartment_snapshots_own on tracker.apartment_snapshots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apartment_price_history_own on tracker.apartment_price_history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apartment_status_history_own on tracker.apartment_status_history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy apartment_changes_own on tracker.apartment_changes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_own on tracker.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy monitoring_logs_own on tracker.monitoring_logs for select to authenticated
  using (user_id = (select auth.uid()));

-- Grants explícitos (default privileges só valem para objetos futuros) --------
grant select, insert, update, delete on all tables in schema tracker to authenticated;
grant all on all tables in schema tracker to service_role;
grant usage, select on all sequences in schema tracker to authenticated, service_role;
revoke insert, update, delete on tracker.monitoring_logs from authenticated;

-- Novo usuário → profile + preferências ---------------------------------------
create function tracker.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into tracker.profiles (id) values (new.id) on conflict do nothing;
  insert into tracker.user_preferences (user_id, notify_email) values (new.id, new.email)
    on conflict do nothing;
  return new;
end $$;
revoke execute on function tracker.handle_new_user() from public, anon, authenticated;

create trigger tracker_on_auth_user_created after insert on auth.users
  for each row execute function tracker.handle_new_user();
