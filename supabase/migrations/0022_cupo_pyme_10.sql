-- ============================================================================
-- MEDISYS · Cupo del plan PyME: de 2 a 10 especialistas
-- ============================================================================
-- CONTEXTO
--   El plan PyME pasa de 5 a 10 especialistas, con el rango 2 a 10 que ya
--   anuncia la landing y que está declarado en `src/lib/suscripcion.ts`
--   (`LIMITE_ESPECIALISTAS_PLAN.PYME = { min: 2, max: 10 }`).
--
--   Las altas del producto ya escriben el cupo explícito, así que no dependen de
--   esta migración: el registro público (`registrarConsultorio`) y el alta del
--   Super Admin usan `cupoInicialRegistro(plan)` → PyME = 10.
--
-- QUÉ HACE
--   1. Alinea el DEFAULT de la columna con el plan por defecto del tenant
--      (`plan_type` también tiene default 'PYME' desde la migración 0020).
--      Antes el default era 5 (migración 0009).
--   2. Corrige las cuentas PyME cuyo cupo quedó FUERA del rango 2..10 (por
--      ejemplo 1, valor que la normalización de 0020 permitía).
--
--   IMPORTANTE: NO sube 5 → 10 en las cuentas existentes. Un cupo intermedio
--   (p. ej. 3, 5, 8) puede ser una configuración deliberada del operador; el
--   Super Admin puede llevar cada cliente al nuevo tope desde
--   `/super-admin/clientes/[id]` (o con el UPDATE opcional de abajo).
--
-- ACCIÓN OPCIONAL DEL OPERADOR (llevar TODAS las cuentas PyME al nuevo tope):
--   update public.tenants set max_especialistas = 10
--    where plan_type = 'PYME' and max_especialistas <> 10;
--
-- IDEMPOTENTE: puede ejecutarse varias veces sin efectos secundarios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Default coherente con el nuevo tope del plan PyME
-- ----------------------------------------------------------------------------
alter table public.tenants
  alter column max_especialistas set default 10;

comment on column public.tenants.max_especialistas is
  'Cupo de especialistas del plan: Individual 1 · PyME 2-10 · PRO 11+ (sin tope).';

-- ----------------------------------------------------------------------------
-- 2. Cuentas PyME dentro del rango 2..10
-- ----------------------------------------------------------------------------
update public.tenants
   set max_especialistas = 2
 where plan_type = 'PYME'
   and coalesce(max_especialistas, 0) < 2;

update public.tenants
   set max_especialistas = 10
 where plan_type = 'PYME'
   and coalesce(max_especialistas, 0) > 10;

-- ----------------------------------------------------------------------------
-- 3. Verificación (cupos por plan tras la migración)
-- ----------------------------------------------------------------------------
select
  plan_type,
  count(*)                as tenants,
  min(max_especialistas)  as min_cupo,
  max(max_especialistas)  as max_cupo
from public.tenants
group by plan_type
order by plan_type;
