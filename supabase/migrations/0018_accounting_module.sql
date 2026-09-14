-- ============================================================================
-- MEDISYS · Módulo 3: Contabilidad, Libros Fiscales y Cuadre de Caja
-- ============================================================================
-- Ejecutable en el SQL Editor de Supabase (o con `supabase db push`).
-- IDEMPOTENTE: puede correrse varias veces sin efectos secundarios.
--
-- Requiere: 0001_auth_multi_tenant.sql, 0016_admin_module.sql,
--           0017_billing_module.sql (facturas, cobros y notas de ajuste).
--
-- Incluye:
--   1. `daily_closings`     → cierre/arqueo de caja diario por sede.
--   2. `doctor_settlements` → liquidación de honorarios por especialista.
--   3. Helper RBAC `puede_contabilizar(tenant)` (admin y contador).
--   4. RLS: lectura del personal; caja para admin/recepción/contador;
--      liquidaciones solo para admin/contador.
--
-- NOTA de diseño: los "enums" se implementan con `text` + `check` (igual que el
-- resto del esquema) para poder evolucionar los catálogos sin migrar tipos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper RBAC contable
-- ----------------------------------------------------------------------------
-- ¿El usuario autenticado puede aprobar/pagar liquidaciones en el tenant?
create or replace function public.puede_contabilizar(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = puede_contabilizar.tenant
      and tu.user_id = auth.uid()
      and tu.role in ('admin', 'contador')
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. `daily_closings` · Cierre y arqueo de caja diario
-- ----------------------------------------------------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- null = caja única de la clínica (sin separar por sede).
  sede_id uuid references public.sedes(id) on delete set null,
  closing_date date not null default current_date,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  -- Esperado por el sistema: cobros VERIFIED del día (incluyen IGTF).
  total_expected_usd numeric(14, 2) not null default 0,
  total_expected_ves numeric(14, 2) not null default 0,
  -- Reportado por el cajero/recepción tras el conteo físico.
  total_actual_usd numeric(14, 2) not null default 0,
  total_actual_ves numeric(14, 2) not null default 0,
  -- Descalce: positivo = sobrante, negativo = faltante.
  difference_usd numeric(14, 2) not null default 0,
  difference_ves numeric(14, 2) not null default 0,
  -- Desglose por método de cobro (esperado vs. contado).
  breakdown_by_method jsonb not null default '[]'::jsonb,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'CLOSED', 'AUDITED')),
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  audited_by uuid references auth.users(id) on delete set null,
  audited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_closings is
  'Cierres/arqueos de caja: compara los cobros del sistema contra el conteo físico.';
comment on column public.daily_closings.breakdown_by_method is
  'Desglose por método: [{ method, expectedUSD, expectedVES, countedUSD, countedVES, differenceUSD, differenceVES }].';

create unique index if not exists daily_closings_sede_dia_idx
  on public.daily_closings (tenant_id, sede_id, closing_date)
  where sede_id is not null;

create unique index if not exists daily_closings_global_dia_idx
  on public.daily_closings (tenant_id, closing_date)
  where sede_id is null;

create index if not exists daily_closings_tenant_fecha_idx
  on public.daily_closings (tenant_id, closing_date desc);

create index if not exists daily_closings_estado_idx
  on public.daily_closings (tenant_id, status);

create or replace function public.touch_daily_closings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists daily_closings_set_updated_at on public.daily_closings;
create trigger daily_closings_set_updated_at
  before update on public.daily_closings
  for each row
  execute function public.touch_daily_closings_updated_at();

alter table public.daily_closings enable row level security;

drop policy if exists "daily_closings_staff_read" on public.daily_closings;
create policy "daily_closings_staff_read"
  on public.daily_closings
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

-- Caja: admin, recepción y contador pueden abrir/cerrar el día.
drop policy if exists "daily_closings_caja_insert" on public.daily_closings;
create policy "daily_closings_caja_insert"
  on public.daily_closings
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "daily_closings_caja_update" on public.daily_closings;
create policy "daily_closings_caja_update"
  on public.daily_closings
  for update
  to authenticated
  using (public.puede_facturar(tenant_id) or public.is_super_admin())
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "daily_closings_admin_delete" on public.daily_closings;
create policy "daily_closings_admin_delete"
  on public.daily_closings
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 2. `doctor_settlements` · Liquidación de honorarios por especialista
-- ----------------------------------------------------------------------------
-- Cómo se calcula (ver `src/lib/accounting-ve.ts`):
--   gross_amount_usd        = Σ subtotal de las líneas facturadas del médico
--                             (facturas cobradas en el período).
--   net_payable_usd         = Σ `invoice_items.doctor_commission_amount`
--                             (honorario pactado en el catálogo).
--   commission_deducted_usd = gross_amount_usd − net_payable_usd (clínica).
create table if not exists public.doctor_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_services_count integer not null default 0
    check (total_services_count >= 0),
  gross_amount_usd numeric(14, 2) not null default 0
    check (gross_amount_usd >= 0),
  commission_deducted_usd numeric(14, 2) not null default 0
    check (commission_deducted_usd >= 0),
  net_payable_usd numeric(14, 2) not null default 0
    check (net_payable_usd >= 0),
  net_payable_ves numeric(14, 2) not null default 0,
  -- Tasa BCV usada para expresar el neto en bolívares.
  bcv_rate_used numeric(18, 4) check (bcv_rate_used is null or bcv_rate_used > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'PAID')),
  payment_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.doctor_settlements is
  'Liquidaciones de honorarios médicos por período, con aprobación y pago.';
comment on column public.doctor_settlements.commission_deducted_usd is
  'Comisión retenida por la clínica = monto bruto facturado − honorarios del médico.';

-- Un período no se liquida dos veces para el mismo especialista.
create unique index if not exists doctor_settlements_periodo_idx
  on public.doctor_settlements (tenant_id, doctor_id, period_start, period_end);

create index if not exists doctor_settlements_tenant_idx
  on public.doctor_settlements (tenant_id, period_end desc);

create index if not exists doctor_settlements_estado_idx
  on public.doctor_settlements (tenant_id, status);

create or replace function public.touch_doctor_settlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists doctor_settlements_set_updated_at on public.doctor_settlements;
create trigger doctor_settlements_set_updated_at
  before update on public.doctor_settlements
  for each row
  execute function public.touch_doctor_settlements_updated_at();

alter table public.doctor_settlements enable row level security;

drop policy if exists "doctor_settlements_staff_read" on public.doctor_settlements;
create policy "doctor_settlements_staff_read"
  on public.doctor_settlements
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

-- Liquidaciones: solo administración y contabilidad.
drop policy if exists "doctor_settlements_contable_insert" on public.doctor_settlements;
create policy "doctor_settlements_contable_insert"
  on public.doctor_settlements
  for insert
  to authenticated
  with check (public.puede_contabilizar(tenant_id) or public.is_super_admin());

drop policy if exists "doctor_settlements_contable_update" on public.doctor_settlements;
create policy "doctor_settlements_contable_update"
  on public.doctor_settlements
  for update
  to authenticated
  using (public.puede_contabilizar(tenant_id) or public.is_super_admin())
  with check (public.puede_contabilizar(tenant_id) or public.is_super_admin());

drop policy if exists "doctor_settlements_admin_delete" on public.doctor_settlements;
create policy "doctor_settlements_admin_delete"
  on public.doctor_settlements
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());
