-- ============================================================================
-- MEDISYS · Limpieza de logos obsoletos / de terceros ("Santa Inés")
-- ============================================================================
-- Los tenants de demostración se sembraron con un logo ajeno a la plataforma.
-- Se anula `logo_url` para que la UI use el avatar de iniciales / marca DEMO.
-- ============================================================================

-- 1) Cualquier tenant con un logo que apunte a "Santa Inés" (con o sin acentos,
--    espacios, guiones o guiones bajos en la URL).
update public.tenants
  set logo_url = null
  where logo_url is not null
    and (
      logo_url ~* 'santa[[:space:]._-]*in'
      or logo_url ~* 'santaines'
    );

-- 2) Asegura que los tenants DEMO no conserven ningún logo previo.
update public.tenants
  set logo_url = null
  where slug in ('clinica-demo', 'medico-pro-demo')
    and logo_url is not null;
