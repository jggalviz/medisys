-- ============================================================================
-- MEDISYS · Módulo de Administración
-- Entidad fiscal · Multimoneda (tasa BCV) · Multi-sede (RBAC) · Catálogo médico
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (o con `supabase db push`). Es
-- IDEMPOTENTE: puede correrse varias veces sin efectos secundarios.
--
-- Requiere: 0001_auth_multi_tenant.sql, 0004_tenant_settings.sql,
--           0007_bcv_rates.sql (tasa de respaldo).
--
-- Incluye:
--   1. Datos fiscales de la entidad (tenants.*) para facturación SENIAT.
--   2. Tabla `currency_rates` (CurrencyRate): motor multimoneda USD/VES.
--   3. Tabla `sedes` (Sede / Location) + `tenant_users.sede_ids`.
--   4. Roles ampliados: admin, recepcion, especialista, medico, contador.
--   5. Tabla `medical_services` (catálogo + honorarios médicos).
--   6. Datos fiscales del paciente/cliente (`profiles.*`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helpers RBAC (seguros, saltan RLS)
-- ----------------------------------------------------------------------------
-- ¿El usuario autenticado es ADMIN del tenant indicado?
create or replace function public.is_tenant_admin(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = is_tenant_admin.tenant
      and tu.user_id = auth.uid()
      and tu.role = 'admin'
  );
$$;

-- ¿El usuario autenticado es ADMIN de al menos una clínica? (tablas globales)
create or replace function public.is_any_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.user_id = auth.uid()
      and tu.role = 'admin'
  );
$$;

-- ¿El usuario autenticado es SUPER ADMIN de la plataforma?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin';
$$;

-- ----------------------------------------------------------------------------
-- 1. Entidad fiscal del tenant (tenants.*)
-- ----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists razon_social text,
  add column if not exists domicilio_fiscal text,
  add column if not exists email_fiscal text,
  add column if not exists imprenta_autorizada text,
  add column if not exists providencia_formas_libres text;

comment on column public.tenants.razon_social is
  'Razón social registrada ante el SENIAT (ej. IBEARTS, C.A.).';
comment on column public.tenants.domicilio_fiscal is
  'Domicilio fiscal declarado ante el SENIAT (distinto de la dirección operativa).';
comment on column public.tenants.email_fiscal is
  'Correo para el envío de facturas/notas de crédito.';
comment on column public.tenants.imprenta_autorizada is
  'Imprenta autorizada por el SENIAT (formas libres).';
comment on column public.tenants.providencia_formas_libres is
  'Número de providencia que autoriza las formas libres.';

-- ----------------------------------------------------------------------------
-- 2. `currency_rates` · Motor de tasa oficial BCV y multimoneda
-- ----------------------------------------------------------------------------
create table if not exists public.currency_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('USD', 'VES')),
  rate numeric(18, 4) not null check (rate > 0),
  effective_date date not null default current_date,
  -- 'BCV' = automática (scraping/cron) · 'MANUAL' = sobreescritura del admin.
  source text not null default 'BCV',
  auto_update boolean not null default true,
  -- Usuario que forzó la tasa (null cuando la cargó el cron/servicio).
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite convivir la tasa oficial y una manual del mismo día (auditoría).
  unique (currency, effective_date, source)
);

comment on table public.currency_rates is
  'Tipos de cambio del sistema. `source = MANUAL` indica sobreescritura del administrador.';
comment on column public.currency_rates.auto_update is
  'Si es true, la plataforma refresca la tasa desde el BCV cada día.';

create index if not exists currency_rates_vigente_idx
  on public.currency_rates (currency, effective_date desc, created_at desc);

create or replace function public.touch_currency_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists currency_rates_set_updated_at on public.currency_rates;
create trigger currency_rates_set_updated_at
  before update on public.currency_rates
  for each row
  execute function public.touch_currency_rates_updated_at();

alter table public.currency_rates enable row level security;

drop policy if exists "currency_rates_public_read" on public.currency_rates;
create policy "currency_rates_public_read"
  on public.currency_rates
  for select
  to anon, authenticated
  using (true);

drop policy if exists "currency_rates_admin_insert" on public.currency_rates;
create policy "currency_rates_admin_insert"
  on public.currency_rates
  for insert
  to authenticated
  with check (public.is_any_tenant_admin() or public.is_super_admin());

drop policy if exists "currency_rates_admin_update" on public.currency_rates;
create policy "currency_rates_admin_update"
  on public.currency_rates
  for update
  to authenticated
  using (public.is_any_tenant_admin() or public.is_super_admin())
  with check (public.is_any_tenant_admin() or public.is_super_admin());

-- Semilla: hereda la última tasa de `bcv_rates` (migración 0007).
insert into public.currency_rates (currency, rate, effective_date, source, auto_update)
select 'USD', r.tasa, r.fecha, 'BCV', true
from public.bcv_rates r
where not exists (select 1 from public.currency_rates)
order by r.fecha desc
limit 1;

-- ----------------------------------------------------------------------------
-- 3. `sedes` · Estructura multi-sede
-- ----------------------------------------------------------------------------
create table if not exists public.sedes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nombre text not null,
  direccion text,
  telefono text,
  -- Sede por defecto del tenant (facturación / agenda).
  es_principal boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nombre)
);

comment on table public.sedes is
  'Sedes (locales) de una clínica. Un usuario puede quedar asignado a una o varias.';

create index if not exists sedes_tenant_idx on public.sedes (tenant_id);

create or replace function public.touch_sedes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sedes_set_updated_at on public.sedes;
create trigger sedes_set_updated_at
  before update on public.sedes
  for each row
  execute function public.touch_sedes_updated_at();

alter table public.sedes enable row level security;

drop policy if exists "sedes_staff_read" on public.sedes;
create policy "sedes_staff_read"
  on public.sedes
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "sedes_admin_insert" on public.sedes;
create policy "sedes_admin_insert"
  on public.sedes
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "sedes_admin_update" on public.sedes;
create policy "sedes_admin_update"
  on public.sedes
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin())
  with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "sedes_admin_delete" on public.sedes;
create policy "sedes_admin_delete"
  on public.sedes
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- Sede principal por defecto para cada clínica existente (idempotente).
insert into public.sedes (tenant_id, nombre, direccion, telefono, es_principal, activo)
select
  t.id,
  'Sede Principal',
  nullif(trim(coalesce(t.domicilio_fiscal, t.direccion, '')), ''),
  t.telefono,
  true,
  true
from public.tenants t
where not exists (select 1 from public.sedes s where s.tenant_id = t.id);

-- ----------------------------------------------------------------------------
-- 4. `tenant_users` · Multi-sede + roles ampliados (RBAC)
-- ----------------------------------------------------------------------------
alter table public.tenant_users
  add column if not exists sede_ids uuid[] not null default '{}';

comment on column public.tenant_users.sede_ids is
  'Sedes asignadas al usuario. Arreglo vacío = acceso a todas las sedes del tenant.';

create index if not exists tenant_users_sede_ids_idx
  on public.tenant_users using gin (sede_ids);

-- Elimina cualquier CHECK previo sobre `role` (por si cambió de nombre) y crea
-- la versión ampliada con los roles del módulo de administración.
do $$
declare
  restriccion record;
begin
  for restriccion in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'tenant_users'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.tenant_users drop constraint %I', restriccion.conname);
  end loop;
end $$;

alter table public.tenant_users
  drop constraint if exists tenant_users_role_check;

alter table public.tenant_users
  add constraint tenant_users_role_check
  check (role in ('admin', 'recepcion', 'especialista', 'medico', 'contador'));

comment on column public.tenant_users.role is
  'Rol del usuario: admin · recepcion · especialista (alias médico) · medico · contador.';

-- ----------------------------------------------------------------------------
-- 5. `medical_services` · Catálogo de servicios y honorarios médicos
-- ----------------------------------------------------------------------------
create table if not exists public.medical_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  -- Código interno/CPT de la clínica (único por tenant).
  code text not null,
  price_usd numeric(12, 2) not null default 0 check (price_usd >= 0),
  -- La mayoría de los servicios médicos directos son exentos de IVA (16%).
  taxable boolean not null default false,
  doctor_commission_type text not null default 'PERCENTAGE'
    check (doctor_commission_type in ('PERCENTAGE', 'FIXED')),
  doctor_commission_value numeric(12, 2) not null default 0
    check (doctor_commission_value >= 0),
  doctor_id uuid references public.doctors(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.medical_services is
  'Catálogo de servicios médicos con precio en USD y comisión del especialista.';
comment on column public.medical_services.taxable is
  'true = aplica IVA (16%). false = exento (servicios médicos directos, Ley de IVA).';

create index if not exists medical_services_tenant_idx
  on public.medical_services (tenant_id, activo);

create or replace function public.touch_medical_services_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists medical_services_set_updated_at on public.medical_services;
create trigger medical_services_set_updated_at
  before update on public.medical_services
  for each row
  execute function public.touch_medical_services_updated_at();

alter table public.medical_services enable row level security;

drop policy if exists "medical_services_staff_read" on public.medical_services;
create policy "medical_services_staff_read"
  on public.medical_services
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "medical_services_admin_insert" on public.medical_services;
create policy "medical_services_admin_insert"
  on public.medical_services
  for insert
  to authenticated
  with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "medical_services_admin_update" on public.medical_services;
create policy "medical_services_admin_update"
  on public.medical_services
  for update
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin())
  with check (public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "medical_services_admin_delete" on public.medical_services;
create policy "medical_services_admin_delete"
  on public.medical_services
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 6. Directorio fiscal de pacientes/clientes (`profiles`)
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists tipo_documento text,
  add column if not exists documento_identidad text,
  add column if not exists razon_social text,
  add column if not exists direccion_fiscal text;

comment on column public.profiles.tipo_documento is
  'Tipo de documento fiscal: V · E (persona natural) · J · G (jurídico) · P (pasaporte).';
comment on column public.profiles.documento_identidad is
  'Cédula o RIF sin separadores (ej. V12345678 / J123456789).';

alter table public.profiles drop constraint if exists profiles_tipo_documento_check;
alter table public.profiles
  add constraint profiles_tipo_documento_check
  check (
    tipo_documento is null
    or tipo_documento in ('V', 'E', 'J', 'G', 'P')
  );

create index if not exists profiles_documento_idx
  on public.profiles (tenant_id, documento_identidad);
