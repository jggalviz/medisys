-- ============================================================================
-- MEDISYS · Gestión de especialistas y horarios
-- ============================================================================
-- Extiende la tabla `doctors` (nomenclatura interna por compatibilidad con el
-- wizard) con los campos operativos del módulo /admin/especialistas.
-- ============================================================================

alter table public.doctors
  add column if not exists cedula text,
  add column if not exists telefono text,
  add column if not exists is_active boolean default true,
  -- Días de atención: 1=Lunes … 6=Sábado (JSON array de enteros).
  add column if not exists dias_atencion jsonb default '[]'::jsonb,
  -- Turno habitual por defecto.
  add column if not exists turno_habitual text default 'ambos'
    check (turno_habitual in ('manana', 'tarde', 'ambos'));
