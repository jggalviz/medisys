-- ============================================================================
-- MEDISYS · Planes de tenants (Clínica multi-especialista vs Médico Pro)
-- ============================================================================
-- plan_type:
--   'CLINICA' → Plan Clínica (N médicos, selector en booking).
--   'PRO'     → Plan Médico Pro (1 médico, asignación automática).
-- ============================================================================

alter table public.tenants
  add column if not exists plan_type text not null default 'CLINICA'
    check (plan_type in ('PRO', 'CLINICA')),
  add column if not exists max_especialistas integer not null default 5;

-- Coherencia: los tenants del Plan Pro nunca permiten más de 1 médico.
update public.tenants
  set max_especialistas = 1
  where plan_type = 'PRO'
    and max_especialistas <> 1;
