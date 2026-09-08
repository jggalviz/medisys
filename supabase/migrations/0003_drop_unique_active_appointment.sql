-- ============================================================================
-- MEDISYS · Permitir múltiples citas por fecha/turno
-- ============================================================================
-- Elimina el índice/restricción única que impide reservas ilimitadas en el
-- wizard público (mismo doctor, fecha y turno → "duplicate key value violates
-- unique constraint idx_unique_active_appointment").
--
-- Ejecutar con `supabase db push` (CLI) o en el SQL Editor de Supabase.
-- ============================================================================

drop index if exists idx_unique_active_appointment;
alter table appointments drop constraint if exists idx_unique_active_appointment;

-- Por seguridad también se elimina cualquier otro índice único parcial que
-- incluya `fecha_hora` (reservas ilimitadas por turno):
do $$
declare idx record;
begin
  for idx in
    select c.relname as nombre
    from pg_index i
    join pg_class c  on c.oid = i.indexrelid
    join pg_class t  on t.oid = i.indrelid
    where t.relname = 'appointments'
      and i.indisunique
      and pg_get_indexdef(i.indexrelid) ilike '%fecha_hora%'
  loop
    execute format('drop index if exists %I', idx.nombre);
    raise notice 'Índice único eliminado: %', idx.nombre;
  end loop;
end $$;
