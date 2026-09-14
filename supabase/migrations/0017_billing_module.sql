-- ============================================================================
-- MEDISYS · Módulo 2: Facturación y Cobros (Venezuela / SENIAT)
-- ============================================================================
-- Ejecutable en el SQL Editor de Supabase (o con `supabase db push`).
-- IDEMPOTENTE: puede correrse varias veces sin efectos secundarios.
--
-- Requiere: 0001_auth_multi_tenant.sql, 0016_admin_module.sql
--           (helpers is_staff / is_tenant_admin / is_super_admin y catálogo).
--
-- Incluye:
--   1. `fiscal_counters`  → punteros correlativos de factura y N° de control.
--   2. `invoices`         → factura fiscal con doble despliegue USD/VES + IGTF.
--   3. `invoice_items`    → detalle por servicio con honorario del médico.
--   4. `payments`         → cobros multimoneda (Pago Móvil, Zelle, efectivo…).
--   5. `credit_notes` y `debit_notes` → notas de ajuste fiscal vinculadas.
--   6. RLS: lectura del personal, escritura para admin/recepción/contador.
--
-- NOTA de diseño: los "enums" se implementan con `text` + `check` (igual que el
-- resto del esquema) para poder evolucionar los catálogos sin migrar tipos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper RBAC de facturación
-- ----------------------------------------------------------------------------
-- ¿El usuario autenticado puede emitir/cobrar en el tenant indicado?
create or replace function public.puede_facturar(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = puede_facturar.tenant
      and tu.user_id = auth.uid()
      and tu.role in ('admin', 'recepcion', 'contador')
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. `fiscal_counters` · Numeración y N° de control (formas libres)
-- ----------------------------------------------------------------------------
create table if not exists public.fiscal_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- null = serie única de la clínica (no separada por sede).
  sede_id uuid references public.sedes(id) on delete cascade,
  doc_type text not null default 'INVOICE'
    check (doc_type in ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE')),
  series text not null default 'A',
  -- Correlativos (se incrementan de forma controlada desde la aplicación).
  next_invoice_number bigint not null default 1 check (next_invoice_number > 0),
  next_control_number bigint not null default 1 check (next_control_number > 0),
  invoice_prefix text not null default '',
  control_prefix text not null default '00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fiscal_counters is
  'Punteros de numeración fiscal: correlativo de factura y N° de control (formas libres).';
comment on column public.fiscal_counters.next_invoice_number is
  'Próximo correlativo del N° de factura. Se formatea a 8 dígitos (ej. 00000042).';
comment on column public.fiscal_counters.next_control_number is
  'Próximo N° de control SENIAT. Se formatea como {control_prefix}-00000042.';

create unique index if not exists fiscal_counters_tenant_global_idx
  on public.fiscal_counters (tenant_id, doc_type, series)
  where sede_id is null;

create unique index if not exists fiscal_counters_tenant_sede_idx
  on public.fiscal_counters (tenant_id, sede_id, doc_type, series)
  where sede_id is not null;

create or replace function public.touch_fiscal_counters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fiscal_counters_set_updated_at on public.fiscal_counters;
create trigger fiscal_counters_set_updated_at
  before update on public.fiscal_counters
  for each row
  execute function public.touch_fiscal_counters_updated_at();

alter table public.fiscal_counters enable row level security;

drop policy if exists "fiscal_counters_staff_read" on public.fiscal_counters;
create policy "fiscal_counters_staff_read"
  on public.fiscal_counters
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "fiscal_counters_factura_write" on public.fiscal_counters;
create policy "fiscal_counters_factura_write"
  on public.fiscal_counters
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "fiscal_counters_factura_update" on public.fiscal_counters;
create policy "fiscal_counters_factura_update"
  on public.fiscal_counters
  for update
  to authenticated
  using (public.puede_facturar(tenant_id) or public.is_super_admin())
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

-- Puntero por defecto para cada clínica existente (idempotente).
insert into public.fiscal_counters (tenant_id, doc_type, series)
select t.id, d.doc_type, 'A'
from public.tenants t
cross join (
  values ('INVOICE'), ('CREDIT_NOTE'), ('DEBIT_NOTE')
) as d(doc_type)
where not exists (
  select 1 from public.fiscal_counters fc
  where fc.tenant_id = t.id and fc.doc_type = d.doc_type and fc.sede_id is null
);

-- ----------------------------------------------------------------------------
-- 2. `invoices` · Factura fiscal con doble despliegue USD / VES
-- ----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  -- Correlativos SENIAT (obligatorios al emitir; vacíos en borrador).
  invoice_number text,
  control_number text,
  -- Paciente de la plataforma (opcional: existen ventas a invitados).
  patient_id uuid references public.profiles(id) on delete set null,
  -- Cita/consulta que origina la factura (cierre de consulta).
  appointment_id uuid references public.appointments(id) on delete set null,
  -- Snapshot fiscal al momento de la venta (no cambia si el paciente se edita).
  fiscal_profile jsonb not null default '{}'::jsonb,
  subtotal_usd numeric(14, 2) not null default 0,
  subtotal_ves numeric(14, 2) not null default 0,
  vat_amount_usd numeric(14, 2) not null default 0,
  vat_amount_ves numeric(14, 2) not null default 0,
  igtf_amount_usd numeric(14, 2) not null default 0,
  igtf_amount_ves numeric(14, 2) not null default 0,
  total_usd numeric(14, 2) not null default 0,
  total_ves numeric(14, 2) not null default 0,
  -- Tasa oficial BCV aplicada en la fecha/hora del cobro.
  bcv_rate_used numeric(18, 4) not null check (bcv_rate_used > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED')),
  payment_status text not null default 'PENDING'
    check (payment_status in ('PENDING', 'PARTIAL', 'PAID')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoices is
  'Facturas fiscales con desglose en USD y VES a la tasa BCV del cobro.';
comment on column public.invoices.fiscal_profile is
  'Datos fiscales del cliente al momento de la venta: tipoDocumento, documentoIdentidad, razonSocial, direccionFiscal.';
comment on column public.invoices.total_usd is
  'Total a pagar = subtotal + IVA + IGTF acumulado de los cobros en divisas.';

create unique index if not exists invoices_tenant_number_idx
  on public.invoices (tenant_id, invoice_number)
  where invoice_number is not null;

create unique index if not exists invoices_tenant_control_idx
  on public.invoices (tenant_id, control_number)
  where control_number is not null;

create index if not exists invoices_tenant_fecha_idx
  on public.invoices (tenant_id, created_at desc);

create index if not exists invoices_tenant_estado_idx
  on public.invoices (tenant_id, status, payment_status);

create or replace function public.touch_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row
  execute function public.touch_invoices_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "invoices_staff_read" on public.invoices;
create policy "invoices_staff_read"
  on public.invoices
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "invoices_factura_insert" on public.invoices;
create policy "invoices_factura_insert"
  on public.invoices
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "invoices_factura_update" on public.invoices;
create policy "invoices_factura_update"
  on public.invoices
  for update
  to authenticated
  using (public.puede_facturar(tenant_id) or public.is_super_admin())
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "invoices_admin_delete" on public.invoices;
create policy "invoices_admin_delete"
  on public.invoices
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. `invoice_items` · Detalle de la factura (servicio + honorario médico)
-- ----------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  -- Desnormalizado para que las políticas RLS no requieran JOIN.
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid references public.medical_services(id) on delete set null,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_usd numeric(14, 2) not null default 0 check (unit_price_usd >= 0),
  unit_price_ves numeric(14, 2) not null default 0,
  taxable boolean not null default false,
  doctor_id uuid references public.doctors(id) on delete set null,
  -- Honorario del especialista por la línea (ya calculado y auditado).
  doctor_commission_amount numeric(14, 2) not null default 0
    check (doctor_commission_amount >= 0),
  created_at timestamptz not null default now()
);

comment on table public.invoice_items is
  'Líneas de la factura: precio unitario USD/VES, IVA y honorario del médico.';

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id);

alter table public.invoice_items enable row level security;

drop policy if exists "invoice_items_staff_read" on public.invoice_items;
create policy "invoice_items_staff_read"
  on public.invoice_items
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "invoice_items_factura_insert" on public.invoice_items;
create policy "invoice_items_factura_insert"
  on public.invoice_items
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "invoice_items_factura_update" on public.invoice_items;
create policy "invoice_items_factura_update"
  on public.invoice_items
  for update
  to authenticated
  using (public.puede_facturar(tenant_id) or public.is_super_admin())
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "invoice_items_admin_delete" on public.invoice_items;
create policy "invoice_items_admin_delete"
  on public.invoice_items
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. `payments` · Cobros multimoneda con IGTF (3% en divisas)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sede_id uuid references public.sedes(id) on delete set null,
  method text not null
    check (method in (
      'PAGO_MOVIL',
      'ZELLE',
      'TRANSFERENCIA_VES',
      'EFECTIVO_USD',
      'EFECTIVO_VES',
      'PUNTO_DE_VENTA'
    )),
  amount_usd numeric(14, 2) not null default 0 check (amount_usd >= 0),
  amount_ves numeric(14, 2) not null default 0 check (amount_ves >= 0),
  -- Últimos 4-6 dígitos de la referencia bancaria / confirmación Zelle.
  reference_number text,
  -- true cuando el pago es en divisas o efectivo no nacional (Zelle, USD).
  applies_igtf boolean not null default false,
  igtf_amount numeric(14, 2) not null default 0 check (igtf_amount >= 0),
  igtf_amount_ves numeric(14, 2) not null default 0,
  status text not null default 'PENDING_VERIFICATION'
    check (status in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
  notes text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is
  'Cobros de una factura. El IGTF (3%) se aplica solo a pagos en divisas.';

create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_tenant_estado_idx
  on public.payments (tenant_id, status, created_at desc);

create or replace function public.touch_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function public.touch_payments_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments_staff_read" on public.payments;
create policy "payments_staff_read"
  on public.payments
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "payments_factura_insert" on public.payments;
create policy "payments_factura_insert"
  on public.payments
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "payments_factura_update" on public.payments;
create policy "payments_factura_update"
  on public.payments
  for update
  to authenticated
  using (public.puede_facturar(tenant_id) or public.is_super_admin())
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "payments_admin_delete" on public.payments;
create policy "payments_admin_delete"
  on public.payments
  for delete
  to authenticated
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. `credit_notes` / `debit_notes` · Notas de ajuste fiscal
-- ----------------------------------------------------------------------------
-- Ambas están OBLIGATORIAMENTE vinculadas a una factura de origen y llevan
-- numeración y N° de control propios (series de `fiscal_counters`).
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  note_number text,
  control_number text,
  amount_usd numeric(14, 2) not null default 0 check (amount_usd >= 0),
  amount_ves numeric(14, 2) not null default 0,
  motivo text not null,
  -- true cuando además se devuelve el dinero al paciente (factura REFUNDED).
  reembolsada boolean not null default false,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.credit_notes is
  'Notas de crédito (anulaciones/ajustes a favor del paciente) con control propio.';

create unique index if not exists credit_notes_tenant_number_idx
  on public.credit_notes (tenant_id, note_number)
  where note_number is not null;

create unique index if not exists credit_notes_tenant_control_idx
  on public.credit_notes (tenant_id, control_number)
  where control_number is not null;

create index if not exists credit_notes_invoice_idx
  on public.credit_notes (invoice_id);

create table if not exists public.debit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  note_number text,
  control_number text,
  amount_usd numeric(14, 2) not null default 0 check (amount_usd >= 0),
  amount_ves numeric(14, 2) not null default 0,
  motivo text not null,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.debit_notes is
  'Notas de débito (cargos adicionales al paciente) con control propio.';

create unique index if not exists debit_notes_tenant_number_idx
  on public.debit_notes (tenant_id, note_number)
  where note_number is not null;

create unique index if not exists debit_notes_tenant_control_idx
  on public.debit_notes (tenant_id, control_number)
  where control_number is not null;

create index if not exists debit_notes_invoice_idx
  on public.debit_notes (invoice_id);

alter table public.credit_notes enable row level security;
alter table public.debit_notes enable row level security;

drop policy if exists "credit_notes_staff_read" on public.credit_notes;
create policy "credit_notes_staff_read"
  on public.credit_notes
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "credit_notes_factura_insert" on public.credit_notes;
create policy "credit_notes_factura_insert"
  on public.credit_notes
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());

drop policy if exists "debit_notes_staff_read" on public.debit_notes;
create policy "debit_notes_staff_read"
  on public.debit_notes
  for select
  to authenticated
  using (public.is_staff(tenant_id) or public.is_super_admin());

drop policy if exists "debit_notes_factura_insert" on public.debit_notes;
create policy "debit_notes_factura_insert"
  on public.debit_notes
  for insert
  to authenticated
  with check (public.puede_facturar(tenant_id) or public.is_super_admin());
