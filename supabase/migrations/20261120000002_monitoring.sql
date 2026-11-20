-- Etapa 3: base do monitoramento automático. Só toca o schema tracker (e habilita extensões).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Início da sequência atual de "não encontrado" (para confirmar "removido" após 12 h).
alter table tracker.apartments add column if not exists last_not_found_at timestamptz;

-- Execução do monitor que gerou o snapshot (idempotência / rastreio).
alter table tracker.apartment_snapshots add column if not exists run_id uuid;
create index if not exists apartment_snapshots_run_idx on tracker.apartment_snapshots (run_id);

-- Tendência de preço: último aluguel e o valor anterior diferente (para setas ▼/▲ nos cards).
-- security_invoker: respeita a RLS de quem consulta.
create or replace view tracker.apartment_price_trend
with (security_invoker = true) as
with ordered as (
  select
    h.id,
    h.apartment_id,
    h.user_id,
    h.rent,
    h.recorded_at,
    lag(h.rent) over (partition by h.apartment_id order by h.recorded_at, h.id) as prev_rent
  from tracker.apartment_price_history h
  where h.rent is not null
),
last_change as (
  select distinct on (apartment_id)
    apartment_id, user_id, rent as latest_rent, prev_rent as previous_rent, recorded_at as changed_at
  from ordered
  where prev_rent is distinct from rent
  order by apartment_id, recorded_at desc, id desc
)
select apartment_id, user_id, latest_rent, previous_rent, changed_at
from last_change;

revoke all on tracker.apartment_price_trend from public, anon;
grant select on tracker.apartment_price_trend to authenticated, service_role;
