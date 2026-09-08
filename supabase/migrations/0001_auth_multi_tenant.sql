-- ============================================================================
-- MEDISYS · Autenticación y control de acceso multi-tenant
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (o con supabase db push) UNA sola vez.
--
-- Incluye:
--   1. Tabla `public.tenant_users` (personal de cada clínica).
--   2. Roles: 'admin' | 'recepcion' | 'especialista'.
--   3. RLS sobre `tenant_users`, `tenants` y `appointments`.
--   4. Función helper `public.is_staff(tenant_id)` usada por las políticas.
--
-- NOTA de nomenclatura: el rol y los tipos usan 'especialista' (no 'medico').
-- La tabla física `doctors` se conserva por compatibilidad con reservas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla tenant_users
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'recepcion', 'especialista')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on table public.tenant_users is
  'Personal autorizado de cada clínica (admin, recepcion, especialista).';
comment on column public.tenant_users.role is
  'Rol del usuario. Se usa ''especialista'' como nomenclatura única.';

-- ----------------------------------------------------------------------------
-- 2. Función helper para políticas (segura, salta RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_staff(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = is_staff.tenant
      and tu.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS · tenant_users
-- ----------------------------------------------------------------------------
alter table public.tenant_users enable row level security;

drop policy if exists "tenant_users_own_select" on public.tenant_users;
create policy "tenant_users_own_select"
  on public.tenant_users
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "tenant_users_admin_insert" on public.tenant_users;
create policy "tenant_users_admin_insert"
  on public.tenant_users
  for insert
  to authenticated
  with check (
    is_staff(tenant_id)
    and exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = tenant_users.tenant_id
        and tu.user_id = auth.uid()
        and tu.role = 'admin'
    )
  );

drop policy if exists "tenant_users_admin_update" on public.tenant_users;
create policy "tenant_users_admin_update"
  on public.tenant_users
  for update
  to authenticated
  using (is_staff(tenant_id))
  with check (is_staff(tenant_id));

-- ----------------------------------------------------------------------------
-- 4. RLS · tenants
-- ----------------------------------------------------------------------------
-- Lectura pública SOLO de clínicas activas (necesaria para la reserva y login).
alter table public.tenants enable row level security;

drop policy if exists "tenants_public_read_active" on public.tenants;
create policy "tenants_public_read_active"
  on public.tenants
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "tenants_staff_all" on public.tenants;
create policy "tenants_staff_all"
  on public.tenants
  for select
  to authenticated
  using (is_staff(id) or is_active = true);

drop policy if exists "tenants_staff_update" on public.tenants;
create policy "tenants_staff_update"
  on public.tenants
  for update
  to authenticated
  using (is_staff(id))
  with check (is_staff(id));

-- ----------------------------------------------------------------------------
-- 5. RLS · appointments
-- ----------------------------------------------------------------------------
-- El paciente anónimo necesita: INSERT para bloquear su cupo y UPDATE de filas
-- 'pendiente' para confirmar pago en línea / pagar en recepción (MVP).
-- El personal autenticado (tenant_users) lee y actualiza su clínica.
alter table public.appointments enable row level security;

drop policy if exists "appointments_public_insert" on public.appointments;
create policy "appointments_public_insert"
  on public.appointments
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "appointments_public_update_pendiente" on public.appointments;
create policy "appointments_public_update_pendiente"
  on public.appointments
  for update
  to anon, authenticated
  using (estado = 'pendiente');

drop policy if exists "appointments_staff_select" on public.appointments;
create policy "appointments_staff_select"
  on public.appointments
  for select
  to authenticated
  using (is_staff(tenant_id));

drop policy if exists "appointments_staff_update" on public.appointments;
create policy "appointments_staff_update"
  on public.appointments
  for update
  to authenticated
  using (is_staff(tenant_id))
  with check (is_staff(tenant_id));

-- ----------------------------------------------------------------------------
-- 6. Inserción de un primer usuario admin de ejemplo (ajustar a mano)
-- ----------------------------------------------------------------------------
-- Insertar el user_id del administrador creado en Supabase Auth:
-- insert into public.tenant_users (tenant_id, user_id, role)
-- select t.id, '<AUTH_USER_ID>'::uuid, 'admin'
-- from public.tenants t
-- where t.slug = 'clinica-demo'
-- on conflict (tenant_id, user_id) do nothing;
