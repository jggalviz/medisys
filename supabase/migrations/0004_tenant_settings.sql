-- ============================================================================
-- MEDISYS · Configuración del tenant (módulo de administración)
-- ============================================================================
-- Agrega los campos operativos que gestiona la vista
-- /[clinicSlug]/admin/configuracion.
-- ============================================================================

alter table public.tenants
  add column if not exists rif text,
  add column if not exists direccion text,
  add column if not exists telefono text,
  -- null/0 = cupos ilimitados por turno (reservas abiertas).
  add column if not exists max_slots_per_shift integer default null,
  -- Switch para pausar la pasarela de Pago Móvil en línea.
  add column if not exists pago_movil_enabled boolean default true;

-- Datos de Pago Móvil: si la columna no existe (JSONB con cuentas + instrucciones):
alter table public.tenants
  add column if not exists datos_pago_movil jsonb;
