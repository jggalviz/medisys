-- ============================================================================
-- MEDISYS · Reservas ilimitadas por turno (cupos abiertos)
-- ============================================================================
-- Ejecutar solo si se necesita garantizar más de una reserva por turno
-- (doctor + fecha + turno) mientras no exista el límite dinámico
-- (`tenant.max_slots_per_shift` / `especialista_config`).
--
-- Elimina cualquier índice ÚNICO existente sobre `appointments` que incluya
-- la columna `fecha_hora` (por ejemplo: appointments_doctor_id_fecha_hora_idx
-- o uno parcial con estado). NO toca la clave primaria (id).
-- ============================================================================

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
