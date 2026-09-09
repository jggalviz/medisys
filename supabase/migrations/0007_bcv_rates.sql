-- ============================================================================
-- MEDISYS · Tasas oficiales BCV (para convertir precios USD → Bolívares)
-- ============================================================================

create table if not exists public.bcv_rates (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  tasa numeric(10, 2) not null,
  fetched_at timestamptz not null default now(),
  fuente text not null default 'BCV'
);

-- Lectura pública (la consulta al tipo de cambio es información pública).
alter table public.bcv_rates enable row level security;

drop policy if exists "bcv_rates_public_read" on public.bcv_rates;
create policy "bcv_rates_public_read"
  on public.bcv_rates
  for select
  using (true);

-- Fila inicial de respaldo (36,50 Bs/USD) mientras no se cargue la tasa real.
insert into public.bcv_rates (fecha, tasa)
select current_date, 36.50
where not exists (
  select 1 from public.bcv_rates
);
