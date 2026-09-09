-- ============================================================================
-- MEDISYS · Portales de Especialista y Paciente (autenticación ligera)
-- ============================================================================
-- Expediente clínico de las consultas: diagnóstico, tratamiento/indicaciones
-- y notas de evolución. Una fila por cita atendida (unique appointment_id).
-- ============================================================================

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_id uuid not null,
  patient_id uuid not null,
  doctor_id uuid not null,
  motivo text,
  diagnostico text,
  tratamiento text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists medical_records_doctor_idx
  on public.medical_records (doctor_id, created_at desc);
create index if not exists medical_records_patient_idx
  on public.medical_records (patient_id, created_at desc);
create index if not exists medical_records_appointment_idx
  on public.medical_records (appointment_id);

-- RLS: los accesos de portales usan el cliente service_role del servidor con
-- filtros estrictos por sesión; sin embargo activamos RLS para que los
-- clientes anónimos/autenticados nunca lean expedientes directamente.
alter table public.medical_records enable row level security;

drop policy if exists "medical_records_no_public_access" on public.medical_records;
create policy "medical_records_no_public_access"
  on public.medical_records
  for all
  using (false)
  with check (false);
