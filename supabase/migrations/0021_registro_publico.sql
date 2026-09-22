-- ============================================================================
-- MEDISYS · Registro público de consultorios + contador de la prueba gratuita
-- ============================================================================
-- CONTEXTO
--   La ruta pública `/registro` (y los CTA de la landing) permiten que un
--   médico o consultorio cree su propia cuenta sin intervención del Super
--   Admin, con la oferta "Prueba gratis - Primeras 10 reservas incluidas sin
--   compromiso".
--
--   El alta (usuario en Supabase Auth + `tenants` + `tenant_users` + primer
--   `doctors`) la ejecuta la Server Action `src/app/actions/registro.ts` con el
--   cliente `service_role`, por lo que NO hacen falta políticas nuevas de RLS.
--
-- QUÉ HACE
--   1. `tenants.reservas_consumidas`    → contador de la prueba (arranca en 0).
--   2. `tenants.reservas_gratis_limite` → reservas incluidas sin pago (10).
--   3. Trigger que incrementa el contador con cada reserva creada.
--   4. Backfill idempotente de los tenants existentes.
--
-- ALCANCE DEL CONTADOR
--   El trigger solo CUENTA: no bloquea la reserva ni bloquea el panel. El corte
--   comercial al agotar la prueba se gestiona con la suscripción
--   (`tenants.suscripcion_vence_at` + `saas_subscription_payments`), de modo que
--   activar el bloqueo automático más adelante solo requiere leer este contador.
--   Se cuenta cada fila insertada en `appointments` (incluye el bloqueo de
--   cupo 'pendiente' que expira a los 15 minutos), que es la unidad de negocio
--   que promete la landing: "reservas", no consultas facturadas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Contador de la prueba gratuita
-- ----------------------------------------------------------------------------
alter table public.tenants
  add column if not exists reservas_consumidas integer not null default 0,
  add column if not exists reservas_gratis_limite integer not null default 10;

-- Idempotente: si una instalación previa dejó nulos/inválidos, se normalizan.
update public.tenants
   set reservas_consumidas = 0
 where reservas_consumidas is null
    or reservas_consumidas < 0;

update public.tenants
   set reservas_gratis_limite = 10
 where reservas_gratis_limite is null
    or reservas_gratis_limite < 1;

-- CHECK tolerantes a re-ejecución (se recrean siempre).
alter table public.tenants
  drop constraint if exists tenants_reservas_consumidas_check;
alter table public.tenants
  add constraint tenants_reservas_consumidas_check
  check (reservas_consumidas >= 0);

alter table public.tenants
  drop constraint if exists tenants_reservas_gratis_limite_check;
alter table public.tenants
  add constraint tenants_reservas_gratis_limite_check
  check (reservas_gratis_limite >= 1);

comment on column public.tenants.reservas_consumidas is
  'Reservas creadas desde el alta de la cuenta (prueba gratuita). Inicia en 0.';
comment on column public.tenants.reservas_gratis_limite is
  'Reservas incluidas sin pago en la prueba gratuita (10 por defecto).';

-- ----------------------------------------------------------------------------
-- 2. Trigger: contar reservas por tenant
-- ----------------------------------------------------------------------------
-- `security definer` para poder escribir en `tenants` aunque la reserva la cree
-- un paciente anónimo (RLS de `tenants` solo permite update al staff).
create or replace function public.contar_reserva_consumida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    return new;
  end if;

  update public.tenants
     set reservas_consumidas = coalesce(reservas_consumidas, 0) + 1
   where id = new.tenant_id;

  return new;
end;
$$;

comment on function public.contar_reserva_consumida() is
  'Incrementa tenants.reservas_consumidas con cada reserva del tenant (prueba gratuita).';

drop trigger if exists appointments_contar_reserva on public.appointments;
create trigger appointments_contar_reserva
  after insert on public.appointments
  for each row execute function public.contar_reserva_consumida();

-- ----------------------------------------------------------------------------
-- 3. Verificación (debe listar los tenants con su consumo actual)
-- ----------------------------------------------------------------------------
select
  slug,
  plan_type,
  reservas_consumidas,
  reservas_gratis_limite,
  greatest(reservas_gratis_limite - reservas_consumidas, 0) as reservas_restantes
from public.tenants
order by reservas_consumidas desc, slug;
