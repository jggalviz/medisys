-- ============================================================================
-- MEDISYS · Guía de Uso y Configuración (Base de Conocimiento / Manual)
-- ============================================================================
-- 1. Tabla `guide_pages` con contenido Markdown gestionado por el Super Admin.
-- 2. RLS: lectura pública/autenticada de páginas publicadas; escritura solo
--    para usuarios con `user_metadata.role = 'super_admin'`.
-- 3. Bucket público 'guides' para las imágenes intercaladas en el editor.
-- 4. Semilla inicial con las guías más útiles de la plataforma.
-- ============================================================================

create table if not exists public.guide_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'Primeros Pasos',
  order_index integer not null default 0,
  content_markdown text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guide_pages_category_idx
  on public.guide_pages (category, order_index);

-- `updated_at` automático.
create or replace function public.touch_guide_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guide_pages_set_updated_at on public.guide_pages;
create trigger guide_pages_set_updated_at
  before update on public.guide_pages
  for each row
  execute function public.touch_guide_pages_updated_at();

-- ----------------------------------------------------------------------------
-- RLS · guide_pages
-- ----------------------------------------------------------------------------
alter table public.guide_pages enable row level security;

-- Lectura para toda la plataforma (páginas publicadas).
drop policy if exists "guide_pages_public_read" on public.guide_pages;
create policy "guide_pages_public_read"
  on public.guide_pages
  for select
  to anon, authenticated
  using (is_published = true);

-- El Super Admin (user_metadata.role) ve también los borradores.
drop policy if exists "guide_pages_super_admin_read" on public.guide_pages;
create policy "guide_pages_super_admin_read"
  on public.guide_pages
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

-- Escritura exclusiva del Super Admin.
drop policy if exists "guide_pages_super_admin_insert" on public.guide_pages;
create policy "guide_pages_super_admin_insert"
  on public.guide_pages
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

drop policy if exists "guide_pages_super_admin_update" on public.guide_pages;
create policy "guide_pages_super_admin_update"
  on public.guide_pages
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  )
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

drop policy if exists "guide_pages_super_admin_delete" on public.guide_pages;
create policy "guide_pages_super_admin_delete"
  on public.guide_pages
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

-- ----------------------------------------------------------------------------
-- Bucket público 'guides' (imágenes del manual)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('guides', 'guides', true)
on conflict (id) do update set public = true;

update storage.buckets
  set file_size_limit = 5242880, -- 5 MB
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  where id = 'guides';

drop policy if exists "guides_public_read" on storage.objects;
create policy "guides_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'guides');

drop policy if exists "guides_super_admin_write" on storage.objects;
create policy "guides_super_admin_write"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'guides'
    and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

drop policy if exists "guides_super_admin_delete" on storage.objects;
create policy "guides_super_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'guides'
    and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'super_admin'
  );

-- ----------------------------------------------------------------------------
-- Semilla inicial de guías
-- ----------------------------------------------------------------------------
insert into public.guide_pages (slug, title, category, order_index, content_markdown)
values
  (
    'primeros-pasos',
    'Primeros pasos en Medisys',
    'Primeros Pasos',
    1,
    $md$# Primeros pasos en Medisys

Bienvenido a tu panel de gestión. En pocos minutos puedes dejar la clínica lista para recibir reservas.

## 1. Completa los datos de la clínica
- Ve a **Configuración → Información General**.
- Revisa nombre comercial, RIF, dirección y teléfono.
- Guarda los cambios con el botón inferior **Guardar cambios**.

## 2. Configura el Pago Móvil
- Entra en **Configuración → Pago Móvil**.
- Agrega una o varias cuentas (banco, cédula/RIF, teléfono, titular).
- Activa el switch de **Pago Móvil en línea** para que aparezca en la reserva.

## 3. Publica tu perfil
- En **Mi Landing Page** activa el perfil público y describe tus servicios.
- Comparte el enlace de tu perfil con tus pacientes.

> **Nota:** los cambios se reflejan de inmediato en la página pública gracias a la revalidación automática.
$md$
  ),
  (
    'branding-y-logo',
    'Branding y logo de la clínica',
    'Personalización',
    1,
    $md$# Branding y logo

Sube el logo oficial para que aparezca en la reserva, el recibo y las confirmaciones.

## Cómo subir el logo
1. Ve a **Configuración → Branding**.
2. Pulsa **Elegir imagen** (PNG, JPG, WEBP o SVG · máximo 3 MB).
3. Pulsa **Subir logo**. El botón *Guardar cambios* permanece bloqueado hasta que subas la imagen.

> **Importante:** primero sube la imagen y luego guarda; así evitamos perder tu selección.

## Buenas prácticas
- Usa una imagen cuadrada y con fondo transparente.
- Evita logos con texto muy pequeño: se verán reducidos en el recibo.
$md$
  ),
  (
    'apariencia-y-colores',
    'Apariencia y colores del perfil',
    'Personalización',
    2,
    $md$# Apariencia y colores

Personaliza los colores de tu perfil público según la identidad de tu consultorio.

## Paletas recomendadas (1 clic)
- **Azul Clínico:** confianza y profesionalismo.
- **Verde Médico:** bienestar y salud.
- **Gris Elegante:** estilo premium y sobrio.

## Ajuste fino
Desde **Configuración → Apariencia** puedes editar cada variable con el selector de color:

| Variable | Uso |
| --- | --- |
| Color primario | Botones y acciones principales |
| Color secundario | Badges y detalles |
| Fondo de página | Fondo general del perfil |
| Fondo de tarjetas | Módulos y fichas |
| Texto de botones | Color del texto sobre el botón principal |

> **Nota:** la vista previa dentro del formulario muestra cómo quedará tu perfil antes de guardar.
$md$
  )
on conflict (slug) do nothing;

insert into public.guide_pages (slug, title, category, order_index, content_markdown)
values
  (
    'especialistas-y-horarios',
    'Especialistas, horarios y cupos',
    'Especialistas',
    1,
    $md$# Especialistas, horarios y cupos

Gestiona tu equipo médico y su disponibilidad.

## Agregar un especialista
1. Ve a **Especialistas**.
2. Pulsa **Nuevo especialista** e ingresa nombre, especialidad, cédula, teléfono y precio de consulta (USD).
3. Define los **días de atención** y el **turno habitual**.

## Cupos por turno
- En **Configuración → Capacidad** define el máximo de reservas por turno.
- Deja el valor vacío o en 0 para reservas ilimitadas.

> **Tip:** si tu plan es **PRO**, la asignación del especialista en la reserva es automática.
$md$
  ),
  (
    'landing-y-perfil-publico',
    'Landing y perfil público',
    'Personalización',
    3,
    $md$# Landing y perfil público

Tu perfil público vive en `/{tu-slug}` y reúne todo lo que el paciente necesita ver.

## Qué puedes editar
- **Hero:** título, subtítulo y especialidades destacadas.
- **Sobre mí:** biografía, subespecialidades, MPPS, colegio médico y universidad.
- **Servicios:** tratamientos destacados con su descripción.
- **Ubicación y horarios:** dirección detallada, punto de referencia y métodos de pago.
- **FAQ:** preguntas frecuentes con respuestas.

## Publicar o pausar
Usa el switch **Landing pública** en **Mi Landing Page**. Si lo desactivas, los visitantes verán una pantalla de mantenimiento con acceso al agendamiento.
$md$
  ),
  (
    'tasa-bcv-y-pagos',
    'Tasa BCV y cobros',
    'Finanzas',
    1,
    $md$# Tasa BCV y cobros

Medisys convierte automáticamente los precios en dólares a bolívares con la tasa oficial.

## ¿De dónde sale la tasa?
- Se consulta en tiempo real desde el portal del **BCV** (con respaldo en APIs públicas).
- Queda guardada como respaldo para que nunca falte una tasa.

## Dónde se usa
- Desglose **USD → Bs.** en el paso de pago de la reserva.
- Tarjetas de recaudación del panel (**toggle USD/VES**).
- Renovación de membresía.

> **Nota:** si la tasa se ve desactualizada, revisa la franja horaria del cron de actualización.
$md$
  ),
  (
    'suscripcion-y-renovacion',
    'Suscripción y renovación de membresía',
    'Finanzas',
    2,
    $md$# Suscripción y renovación

Mantén tu servicio activo renovando la membresía a tiempo.

## Aviso de vencimiento
- Si faltan **5 días o menos**, el panel muestra un banner de alerta.

## Cómo renovar
1. Pulsa **Renovar Membresía** en el banner.
2. Revisa el monto en **USD** y su equivalente en **Bs.** según la tasa BCV.
3. Haz el Pago Móvil a los datos oficiales mostrados.
4. Reporta el pago con banco de origen, referencia (4 a 6 dígitos), teléfono y comprobante.

## Aprobación
El equipo de Medisys valida el reporte y suma **+30 días** a tu vencimiento, reactivando la clínica si estaba inactiva.
$md$
  )
on conflict (slug) do nothing;

insert into public.guide_pages (slug, title, category, order_index, content_markdown)
values
  (
    'gestion-de-citas-y-recepcion',
    'Gestión de citas y recepción',
    'Operación',
    1,
    $md$# Gestión de citas y recepción

El módulo de **Recepción** es el centro de operaciones del día: controla la cola de pacientes, valida pagos y cobra en caja.

## Flujo diario recomendado
1. Abre **Recepción** y revisa la agenda de hoy (ordenada por hora).
2. Marca la **llegada** del paciente (pasa a *En espera*).
3. Cobra en caja cuando corresponda: **efectivo**, **punto de venta** o **pago móvil en sitio**.
4. Mueve la cita a *En consulta* al entrar al consultorio y a *Atendido* al finalizar.

## Validar pagos en línea
- En **Pagos** revisa los comprobantes con estado *Por validar*.
- Compara referencia, teléfono emisor y monto; luego **Aprobar** o **Rechazar**.

## Estados de una cita

| Estado | Significado |
| --- | --- |
| pendiente | Cupo bloqueado, sin pago registrado |
| pendiente_validacion | Pago móvil en línea reportado |
| confirmada | Pago validado por la clínica |
| en_espera | Paciente presente en sala |
| en_consulta | En atención médica |
| atendido | Consulta finalizada |

> **Tip:** si un paciente cancela, usa *Cancelada* en lugar de eliminarla: mantiene el historial y libera el cupo.
$md$
  ),
  (
    'crm-historico-de-pacientes',
    'CRM e histórico de pacientes',
    'Operación',
    2,
    $md$# CRM e histórico de pacientes

Cada paciente guarda su ficha, sus familiares y todas sus consultas anteriores.

## Perfiles y familiares
- En la reserva el paciente puede registrarse **con nombre, cédula y teléfono**.
- Un mismo titular puede tener **familiares/menores** asociados (útil para pediatría).

## Historial clínico
- Cada consulta atendida puede cerrarse con **motivo, diagnóstico, tratamiento y notas**.
- El especialista lo completa desde su **Portal del Especialista** (cédula + teléfono).
- El paciente puede consultar su **expediente** en el **Portal del Paciente**.

## Qué permite el histórico
- Ver la evolución del paciente entre consultas.
- Reutilizar sus datos en la siguiente cita (menos tiempo en recepción).
- Adjuntar el comprobante de pago de cada cita.

> **Nota:** el expediente clínico solo se muestra al paciente dueño y al especialista que atendió la consulta.
$md$
  ),
  (
    'roles-y-seguridad',
    'Roles y seguridad de acceso',
    'Primeros Pasos',
    2,
    $md$# Roles y seguridad de acceso

Medisys separa los accesos por **rol**, con sesiones independientes por canal.

## Roles del panel administrativo

| Rol | Puede |
| --- | --- |
| Administrador | Configuración, especialistas, landing, pagos, recepción |
| Recepción | Recepción, validación de pagos, agenda del día |
| Especialista | Solo sus pacientes y expedientes (portal propio) |

## Canales de acceso
- **Panel de staff** → `/{tu-slug}/login` con correo y contraseña (Supabase Auth).
- **Portal del Especialista** → `/{tu-slug}/especialista/login` con **cédula + teléfono** registrados.
- **Portal del Paciente** → `/{tu-slug}/paciente/login` con **cédula + teléfono**.

## Buenas prácticas
- Asigna permisos mínimos: la mayoría del personal solo necesita *Recepción*.
- Revisa periódicamente quién tiene rol *Administrador*.
- Todas las consultas se filtran por la clínica del usuario en sesión (multi-tenant).

> **Nota:** los portales usan una cookie firmada con HMAC y expiran automáticamente.
$md$
  )
on conflict (slug) do nothing;


insert into public.guide_pages (slug, title, category, order_index, content_markdown)
values
  (
    'pago-movil-y-metodos-de-pago',
    'Pago Móvil y métodos de pago',
    'Finanzas',
    3,
    $md$# Pago Móvil y métodos de pago

Configura cómo y dónde te paga el paciente. Medisys soporta **Pago Móvil**, **Zelle**, **Transferencia**, **Efectivo**, **Punto de Venta** y **Pago en recepción**.

## 1. Configurar el Pago Móvil
1. Ve a **Configuración → Pago Móvil**.
2. Pulsa **+ Agregar cuenta** y completa los datos oficiales:

| Campo | Ejemplo | Notas |
| --- | --- | --- |
| Banco | Banesco | Selección de la lista de bancos venezolanos |
| Cédula / RIF | V-12345678 · J-40555123-7 | Puede ser personal o jurídico |
| Teléfono | 0414-1234567 | Debe estar afiliado al Pago Móvil |
| Titular | Clínica Demo C.A. | Nombre que verá el paciente |

3. Activa el switch **Pago Móvil en línea** para que aparezca en la reserva.
4. Guarda con **Guardar cambios**.

> **Nota:** el switch *Pago Móvil en línea* es independiente de los demás métodos. Si lo desactivas, el paciente solo verá las demás opciones.

## 2. Activar Zelle, transferencia, efectivo y punto de venta
- En la misma pestaña agrega las cuentas que aceptes; para **Zelle** indica el correo y el titular.
- El método **Efectivo** y **Punto de Venta** se cobran en **Recepción** el día de la cita.
- El paciente puede elegir **pagar en recepción** cuando no quiera transferir antes.

## 3. Qué ve el paciente en la reserva
1. Elige paciente, especialista y turno.
2. En el paso **Pago** ve tus datos oficiales con el desglose en **USD** y **Bs.** (tasa BCV del día).
3. Si paga en línea, completa:
   - **Banco de origen** (obligatorio)
   - **Referencia** de la transferencia (4 a 6 dígitos)
   - **Teléfono emisor**
   - **Comprobante** (foto o PDF, opcional pero recomendado)
4. Al enviar, la cita queda en **Por validar** hasta que recepción la apruebe.

> **Tip:** adjuntar el comprobante acelera la validación y evita llamadas al paciente.
$md$
  ),
  (
    'capacidad-y-cupos-por-turno',
    'Capacidad y cupos por turno',
    'Operación',
    3,
    $md$# Capacidad y cupos por turno

Controla cuántas citas acepta el sistema para evitar sobre-agendamiento y mantener la calidad de atención.

## Dónde se configura
1. Ve a **Configuración → Capacidad**.
2. Define el **Máximo de reservas por turno (mañana/tarde)**.
3. Guarda con **Guardar cambios**.

## Ilimitado vs. restringido

| Configuración | Comportamiento | Cuándo usarla |
| --- | --- | --- |
| Vacío o `0` | Reservas **ilimitadas** por turno | Consultorio con agenda flexible |
| `1` a `N` | Bloquea nuevas reservas al alcanzar el tope | Clínicas con cupos fijos |

## Cómo interactúan los límites
- El tope se evalúa **por turno** (mañana y tarde por separado), no por día completo.
- Los horarios por especialista (`schedules`) siguen definiendo los cupos de tiempo de cada médico.
- Cuando el turno se llena, el wizard deja de ofrecer ese turno y sugiere el siguiente disponible.

> **Tip:** si una jornada se llena siempre, considera ampliar el horario del especialista en **Especialistas → Horarios** antes de subir el tope global.

> **Nota:** las citas *canceladas* o *expiradas* liberan su cupo automáticamente.
$md$
  ),
  (
    'notificaciones-y-confirmaciones',
    'Notificaciones y confirmaciones',
    'Operación',
    4,
    $md$# Notificaciones y confirmaciones

Así se comunica Medisys con el paciente para que no se pierda ninguna cita.

## Confirmación de la cita
- Al reservar, el paciente ve en pantalla el **resumen** de su cita (especialista, fecha, turno y estado).
- El estado evoluciona de forma transparente:

| Estado | Lo que significa para el paciente |
| --- | --- |
| Por validar | Enviamos tu pago a revisión |
| Confirmada | Tu pago fue validado, la cita está reservada |
| En espera | Ya estás registrado en sala |
| Atendido | Tu consulta finalizó |

## Comprobante digital
- Desde el resumen de la cita el paciente puede **descargar el comprobante en PDF**.
- Incluye logo de la clínica, datos del paciente, especialista, fecha/turno y estado del pago.
- También puede **compartir los detalles por WhatsApp** al número de la clínica.

## Recordatorios
- El paciente puede volver a entrar a la misma URL de reserva desde su móvil para revisar su cita.
- La recepción puede contactarlo con un clic usando el teléfono registrado en su ficha.

> **Nota:** Medisys no envía SMS por defecto; todas las confirmaciones quedan visibles en la pantalla de la reserva y en el comprobante descargable.

> **Tip:** mantén un teléfono/WhatsApp actualizado en **Configuración → Información General**: se usa para el contacto y los enlaces de compartir.
$md$
  )
on conflict (slug) do nothing;


insert into public.guide_pages (slug, title, category, order_index, content_markdown)
values
  (
    'confirmacion-automatica-pago-movil',
    'Confirmación Automática de Pago Móvil (SMS Gateway)',
    'Finanzas',
    4,
    $md$# Confirmación Automática de Pago Móvil (SMS Gateway)

Convierte el teléfono de recepción en un **gateway de conciliación**: cada SMS bancario que llega al equipo se lee automáticamente y la cita pasa de *Por validar* a *Confirmada* sin intervención manual.

## ¿Cómo funciona?
1. Un **teléfono Android dedicado** (con la SIM que recibe los SMS del banco) queda en recepción.
2. La app **Android Gateway** detecta cada SMS bancario y lo reenvía por **Webhook** a la plataforma.
3. Medisys **lee la referencia**, valida el **monto** y busca la cita pendiente que coincide.
4. La cita se confirma **en tiempo real** y se registra la **auditoría** (remitente, texto, hora, referencia).

> **Tip:** no hay comisiones por transacción: el cobro sigue siendo un Pago Móvil normal, solo se automatiza la *lectura* del mensaje.

## Requisitos
- **Teléfono Android** dedicado (versión 8 o superior) que permanezca encendido, cargando y con señal.
- **SIM** con la línea que **recibe los SMS bancarios** de la clínica (la misma del Pago Móvil configurado).
- Conexión **Wi-Fi o datos** estable en el teléfono.
- Los **datos de Pago Móvil** cargados en **Configuración → Pago Móvil**.

## Pasos de configuración
1. **Instala la app Android Gateway** en el teléfono de recepción y concédele el permiso de *Lectura de SMS*.
2. En la app, abre **Ajustes → Webhook** y pega la **URL de la plataforma** que te entrega Medisys:
   - Formato: `https://<tu-dominio>/api/pagos/sms-webhook`
3. Copia el **token de seguridad** de tu clínica y pégalo en la app (se envía como cabecera `Authorization: Bearer …`).
4. Configura el **filtro de emisores bancarios** para ignorar SMS personales. Ejemplos de remitentes:

| Banco / Servicio | Remitente típico |
| --- | --- |
| Banesco | 2652 |
| Mercantil | 2383 |
| Banco de Venezuela | 0102 |
| Provincial (BBVA) | 2654 |

5. Guarda y envía un **SMS de prueba** desde el teléfono para verificar la conexión (la app debe responder `200 OK`).

> **Nota:** si el webhook responde con error, revisa que el token esté completo y que el teléfono tenga salida a internet.

## Flujo de conciliación
1. El paciente reporta su Pago Móvil desde la reserva (referencia, teléfono emisor y comprobante).
2. La cita queda en estado **Por validar**.
3. Llega el SMS del banco al teléfono de recepción → la app lo reenvía al webhook.
4. El sistema **extrae la referencia** y **valida el monto** contra el precio de la consulta.
5. Si coincide, la cita pasa automáticamente a **Confirmada** y se guarda el **registro de auditoría**.
6. Si no coincide (monto distinto, referencia repetida o SMS de otro emisor), la cita se mantiene en **Por validar** para revisión manual.

## Manual vs. Automática por SMS

| Criterio | Verificación manual | Automática por SMS |
| --- | --- | --- |
| Tiempo de confirmación | Minutos u horas (depende del personal) | Segundos, en tiempo real |
| Errores de transcripción | Posibles (referencia/teléfono) | Sin transcripción manual |
| Cobertura fuera de horario | Limitada al horario de recepción | 24/7 mientras el teléfono esté activo |
| Costo por transacción | — | Sin comisiones adicionales |
| Requisito | Conexión a internet | Teléfono Android + SIM dedicados |
| Auditoría | Manual en el panel | Automática (SMS, remitente, hora, referencia) |

> **Tip:** en Android, desactiva la **optimización de batería** para la app Gateway (Ajustes → Batería → Sin restricciones) y bloquearla en apps recientes. Si el sistema la suspende, los SMS no se reenviarán hasta que vuelvas a abrirla.

> **Nota:** Medisys no almacena el SMS completo más allá de lo necesario para la conciliación; se conserva la referencia, el monto y la marca de tiempo para la auditoría de la cita.
$md$
  )
on conflict (slug) do nothing;

