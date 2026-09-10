-- ============================================================================
-- MEDISYS · Landing Page / Perfil Profesional del tenant
-- ============================================================================
-- `landing_enabled`  → switch público: si es false, /{slug} muestra una
--                      pantalla de mantenimiento.
-- `landing_config`   → contenido editable (JSONB):
--   { hero_titulo, hero_subtitulo, sobre_nosotros, horarios,
--     instagram, facebook, servicios: [{ titulo, descripcion }] }
-- ============================================================================

alter table public.tenants
  add column if not exists landing_enabled boolean not null default true,
  add column if not exists landing_config jsonb;

comment on column public.tenants.landing_enabled is
  'Switch de la Landing Page pública del tenant (/{slug}).';
comment on column public.tenants.landing_config is
  'Contenido editable de la Landing Page (hero, sobre nosotros, servicios…).';
