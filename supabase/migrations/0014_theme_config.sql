-- ============================================================================
-- MEDISYS · Tema/Apariencia de los perfiles públicos (landing de la clínica)
-- ============================================================================
-- `theme_config` (JSONB) guarda la paleta del perfil público:
--   { primaryColor, secondaryColor, backgroundColor,
--     cardBackgroundColor, buttonTextColor }
-- Si es NULL, la aplicación aplica los valores por defecto neutros.
-- ============================================================================

alter table public.tenants
  add column if not exists theme_config jsonb;

comment on column public.tenants.theme_config is
  'Paleta de colores del perfil público: primaryColor, secondaryColor, backgroundColor, cardBackgroundColor, buttonTextColor.';
