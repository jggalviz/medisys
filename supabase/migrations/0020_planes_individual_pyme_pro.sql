-- ============================================================================
-- MEDISYS · Planes comerciales: INDIVIDUAL · PYME · PRO
-- ============================================================================
-- OBJETIVO
--   Unificar `plan_type` en 3 tiers alineados con la landing pública (`/`):
--     INDIVIDUAL → 1 especialista · $10 USD/mes ($100/año)
--     PYME       → 2 a 10 especialistas · $40 USD/mes ($400/año)
--     PRO        → 10+ especialistas o múltiples sedes · $80 USD/mes ($800/año)
--
-- CONTEXTO
--   El esquema original (0009/0010) usaba 'CLINICA' | 'PRO'; en instalaciones
--   dadas de alta a mano quedaron además 'independiente' | 'multi_especialista'.
--   Los precios y cupos viven en `src/lib/suscripcion.ts`.
--
-- QUÉ HACE
--   1. Quita los CHECK de `plan_type` (cuyo nombre varía según cómo se creó).
--   2. Normaliza los datos heredados a los 3 valores nuevos.
--   3. Ajusta `tenants.max_especialistas` al rango de cada tier.
--   4. Restaura CHECK + defaults.
--   5. Corrige la guía publicada que llama "PRO" al plan de 1 especialista.
--
-- IDEMPOTENTE: puede ejecutarse varias veces sin efectos secundarios. Los
-- descensos de cupo se aplican solo cuando el valor queda fuera del rango del
-- tier; un PRO con cupo 999 (sin tope) se conserva tal cual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quitar los CHECK actuales de `plan_type`
-- ----------------------------------------------------------------------------
do $$
declare
  restriccion record;
begin
  for restriccion in
    select rel.relname as tabla, con.conname as nombre
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('tenants', 'saas_subscription_payments')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%plan_type%'
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      restriccion.tabla,
      restriccion.nombre
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Normalizar datos heredados en `tenants`
-- ----------------------------------------------------------------------------
-- 2a. Plan de 1 especialista: 'PRO' histórico (0009/0010) e 'independiente'.
--     Se exige cupo <= 1 para no tocar un PRO nuevo (cupo 11+) al re-ejecutar.
update public.tenants
   set plan_type = 'INDIVIDUAL'
 where lower(plan_type) in ('independiente', 'medico_pro')
    or (lower(plan_type) = 'pro' and coalesce(max_especialistas, 1) <= 1);

-- 2b. Multi-especialista: 'CLINICA' (0009/0010) y 'multi_especialista'.
--     Cupo > 10 → PRO · resto → PYME.
update public.tenants
   set plan_type = 'PRO'
 where lower(plan_type) in ('clinica', 'multi_especialista')
   and coalesce(max_especialistas, 0) > 10;

update public.tenants
   set plan_type = 'PYME'
 where lower(plan_type) in ('clinica', 'multi_especialista');

-- 2c. Cualquier otro valor desconocido → PYME (tier intermedio).
update public.tenants
   set plan_type = 'PYME'
 where plan_type not in ('INDIVIDUAL', 'PYME', 'PRO');

-- 2d. Cupos coherentes con el tier
update public.tenants
   set max_especialistas = 1
 where plan_type = 'INDIVIDUAL'
   and coalesce(max_especialistas, 0) <> 1;

update public.tenants
   set max_especialistas = 11
 where plan_type = 'PRO'
   and coalesce(max_especialistas, 0) < 11;

update public.tenants
   set max_especialistas = least(greatest(coalesce(max_especialistas, 1), 1), 10)
 where plan_type = 'PYME'
   and (
     max_especialistas is null
     or max_especialistas < 1
     or max_especialistas > 10
   );

-- ----------------------------------------------------------------------------
-- 3. Normalizar los reportes de pago de suscripción
-- ----------------------------------------------------------------------------
-- Se traducen los valores heredados inequívocos. Las filas 'PRO' se dejan como
-- están: el rótulo que ve el Super Admin se resuelve con el plan vigente del
-- tenant (`getPagosSuscripcionPendientes`) y el importe queda en `monto_usd`.
update public.saas_subscription_payments
   set plan_type = 'INDIVIDUAL'
 where lower(plan_type) in ('independiente', 'medico_pro');

update public.saas_subscription_payments
   set plan_type = 'PYME'
 where lower(plan_type) in ('clinica', 'multi_especialista');

-- ----------------------------------------------------------------------------
-- 4. CHECK + defaults nuevos
-- ----------------------------------------------------------------------------
alter table public.tenants
  alter column plan_type set default 'PYME';

alter table public.tenants
  drop constraint if exists tenants_plan_type_check;

alter table public.tenants
  add constraint tenants_plan_type_check
  check (plan_type in ('INDIVIDUAL', 'PYME', 'PRO'));

alter table public.saas_subscription_payments
  alter column plan_type set default 'PYME';

alter table public.saas_subscription_payments
  drop constraint if exists saas_subscription_payments_plan_type_check;

alter table public.saas_subscription_payments
  add constraint saas_subscription_payments_plan_type_check
  check (plan_type in ('INDIVIDUAL', 'PYME', 'PRO'));

-- ----------------------------------------------------------------------------
-- 5. Guía publicada: el "Plan PRO" antiguo (1 especialista) ahora es Individual
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.guide_pages') is not null then
    update public.guide_pages
       set content_markdown = replace(
             content_markdown,
             'si tu plan es **PRO**',
             'si tu plan es **Individual**'
           )
     where content_markdown like '%si tu plan es **PRO**%';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Verificación (debe devolver solo INDIVIDUAL · PYME · PRO)
-- ----------------------------------------------------------------------------
select
  plan_type,
  count(*)               as tenants,
  min(max_especialistas) as min_cupo,
  max(max_especialistas) as max_cupo
from public.tenants
group by plan_type
order by plan_type;
