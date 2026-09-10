-- ============================================================================
-- MEDISYS · Bucket público 'branding' (logos de las clínicas)
-- ============================================================================
-- 1. Crea el bucket si no existe (idempotente); lo deja público para que el
--    logo pueda mostrarse en la landing, el login y el comprobante.
-- 2. Lectura pública de los objetos del bucket.
-- 3. Escritura/actualización solo para el staff del tenant dueño de la carpeta.
--
-- Convención de rutas: `{tenant_id}/{timestamp}-logo.{ext}`; el primer nivel
-- del path es el UUID del tenant y se usa en las políticas de Storage.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- Límites de tamaño y tipos permitidos para el logo.
update storage.buckets
  set file_size_limit = 3145728, -- 3 MB
      allowed_mime_types = array[
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/svg+xml'
      ]
  where id = 'branding';

-- ----------------------------------------------------------------------------
-- Políticas de storage.objects para el bucket 'branding'
-- ----------------------------------------------------------------------------
drop policy if exists "branding_public_read" on storage.objects;
create policy "branding_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'branding');

-- El primer nivel del path debe ser un UUID válido (tenant_id) del staff.
drop policy if exists "branding_staff_insert" on storage.objects;
create policy "branding_staff_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_staff(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "branding_staff_update" on storage.objects;
create policy "branding_staff_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_staff(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_staff(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "branding_staff_delete" on storage.objects;
create policy "branding_staff_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_staff(((storage.foldername(name))[1])::uuid)
  );
