-- ============================================================================
-- MEDISYS · Dashboard administrativo
-- ============================================================================
-- Asegura el precio de consulta para el cálculo de recaudación estimada.
-- ============================================================================

alter table public.doctors
  add column if not exists precio_consulta numeric(12, 2) default 0;
