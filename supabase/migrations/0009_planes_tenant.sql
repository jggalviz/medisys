-- ============================================================================
-- MEDISYS · Planes de tenants (Clínica multi-especialista vs Médico Pro)
-- ============================================================================
-- plan_type:
--   'multi_especialista' → Plan Clínica (N médicos, selector en booking).
--   'independiente'      → Plan Médico Pro (1 médico, asignación automática).
-- ============================================================================

alter table public.tenants
  add column if not exists plan_type text not null default 'multi_especialista'
    check (plan_type in ('multi_especialista', 'independiente')),
  add column if not exists max_especialistas integer not null default 5;

-- Coherencia: los tenants independientes nunca permiten más de 1 médico.
update public.tenants
  set max_especialistas = 1
  where plan_type = 'independiente'
    and max_especialistas <> 1;
