-- ============================================================================
-- MEDISYS · Suscripciones del SaaS (vencimiento + reportes de pago)
-- ============================================================================
-- 1. `tenants.suscripcion_vence_at`: fecha de vencimiento de la membresía.
-- 2. `saas_subscription_payments`: reportes de pago móvil de las clínicas
--    (PENDIENTE → APROBADO/RECHAZADO por el Super Admin).
-- ============================================================================

alter table public.tenants
  add column if not exists suscripcion_vence_at timestamptz;

-- Backfill: las clínicas existentes reciben 30 días desde hoy.
update public.tenants
  set suscripcion_vence_at = now() + interval '30 days'
  where suscripcion_vence_at is null;

-- ----------------------------------------------------------------------------
-- Reportes de pago de suscripción
-- ----------------------------------------------------------------------------
create table if not exists public.saas_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_type text not null default 'CLINICA'
    check (plan_type in ('PRO', 'CLINICA')),
  monto_usd numeric(10, 2) not null default 0,
  monto_ves numeric(14, 2) not null default 0,
  tasa_bcv numeric(10, 2) not null default 0,
  banco_origen text,
  referencia_pago text not null,
  telefono_emisor text,
  comprobante_url text,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  nota text,
  aprobado_por uuid,
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saas_subscription_payments_tenant_idx
  on public.saas_subscription_payments (tenant_id, created_at desc);
create index if not exists saas_subscription_payments_estado_idx
  on public.saas_subscription_payments (estado, created_at desc);

-- RLS: el staff de cada clínica reporta y consulta sus propios pagos; la
-- aprobación/rechazo se hace con el cliente service_role (bypass RLS).
alter table public.saas_subscription_payments enable row level security;

drop policy if exists "saas_payments_staff_select" on public.saas_subscription_payments;
create policy "saas_payments_staff_select"
  on public.saas_subscription_payments
  for select
  to authenticated
  using (public.is_staff(tenant_id));

drop policy if exists "saas_payments_admin_insert" on public.saas_subscription_payments;
create policy "saas_payments_admin_insert"
  on public.saas_subscription_payments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = saas_subscription_payments.tenant_id
        and tu.user_id = auth.uid()
        and tu.role = 'admin'
    )
  );
