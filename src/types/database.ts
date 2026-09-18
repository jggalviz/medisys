/**
 * MEDISYS · Tipos de base de datos (Supabase / PostgreSQL)
 * ----------------------------------------------------------
 * Fuente única de tipos para las tablas públicas del tenant médico.
 *
 * ESQUEMA ESPERADO (snake_case en Postgres, igual que los tipos JS):
 *  tenants
 *    id uuid pk, slug text unique, nombre text, logo_url text|null,
 *    telefono text|null, direccion text|null, is_active boolean,
 *    datos_pago_movil jsonb|null, created_at timestamptz
 *  profiles                 (pacientes: titular + familiares/menores)
 *    id uuid pk, tenant_id uuid fk, user_id uuid|null fk auth.users,
 *    nombres text, apellidos text, cedula text|null, telefono text|null,
 *    email text|null, fecha_nacimiento date|null, es_menor boolean,
 *    es_titular boolean, parentesco text|null, created_at timestamptz
 *  doctors
 *    id uuid pk, tenant_id uuid fk, nombres text, apellidos text,
 *    especialidad text, especialidades text[] (badges), foto_url text|null,
 *    precio_consulta numeric(10,2), activo boolean, created_at timestamptz
 *  schedules                (disponibilidad semanal por doctor)
 *    id uuid pk, tenant_id uuid fk, doctor_id uuid fk, dia_semana smallint,
 *    hora_inicio time, hora_fin time, duracion_min smallint, activo boolean
 *  appointments
 *    id uuid pk, tenant_id uuid fk, doctor_id uuid fk, patient_id uuid fk,
 *    fecha_hora timestamptz, estado text (ver AppointmentStatus),
 *    lock_expira_en timestamptz|null, referencia_pago text|null,
 *    telefono_emisor text|null, banco_origen text|null,
 *    comprobante_url text|null, created_at timestamptz
 *
 * CONVENCIONES:
 *  - fecha  -> 'YYYY-MM-DD';  hora -> 'HH:mm' (24h);  timestamptz -> ISO 8601.
 *  - dia_semana: 0=Domingo … 6=Sábado (igual a JS `getDay()` y a `EXTRACT(DOW)`).
 *  - `es_menor`/`es_titular` viven en la fila del paciente.
 *
 * RLS RECOMENDADO (para desplegar la app real):
 *  - SELECT público sobre tenants/doctors/schedules (is_active).
 *  - profiles: SELECT/INSERT para el usuario autenticado (user_id = auth.uid())
 *    y, opcionalmente, INSERT anónimo para carga rápida de pacientes en kiosco.
 *  - appointments: INSERT con estado 'pendiente' y UPDATE del comprobante
 *    sólo sobre filas propias (user_id = auth.uid() o paciente propio).
 *  - Bucket público 'comprobantes' con INSERT anónimo/autenticado.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined }

/** Minutos durante los cuales una cita queda bloqueada esperando el pago. */
export const LOCK_DURATION_MINUTES = 15

/** Zona horaria de Venezuela (America/Caracas, sin horario de verano). */
export const VE_TIMEZONE = "-04:00"

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export type AppointmentStatus =
  | "pendiente" // cupo bloqueado (lock de 15 min), esperando decisión de pago
  | "pendiente_validacion" // pagó en línea; la clínica debe validar comprobante/referencia
  | "pago_en_recepcion" // eligió pagar el día de la cita en recepción
  | "confirmada" // pago validado por la clínica
  | "pago_rechazado" // pago rechazado por la recepción (comprobante no válido)
  | "en_espera" // paciente llegó a la clínica y espera en sala
  | "en_consulta" // el especialista está atendiendo al paciente
  | "atendido" // consulta finalizada
  | "completada"
  | "cancelada"
  | "expirada" // lock vencido sin pago (slot liberado)

export type PagoEstado =
  | "pendiente"
  | "en_revision" // comprobante recibido, esperando confirmación del tenant
  | "pagada"
  | "rechazada"

export type MetodoCobro = "pago_movil" | "zelle"

/* ------------------------------------------------------------------ */
/* tenants                                                             */
/* ------------------------------------------------------------------ */

/** Datos bancarios del tenant para Pago Móvil / Zelle. */
export type CuentaCobro = {
  metodo: MetodoCobro
  /** Nombre visible del banco, p. ej. "Banco Nacional de Crédito". */
  banco: string | null
  /** Titular de la cuenta o del correo Zelle. */
  titular: string
  /** Cédula o RIF asociado al pago móvil. */
  cedula_rif: string | null
  /** Teléfono registrado en el Pago Móvil (con prefijo 04xx…). */
  telefono: string | null
  /** Correo del Zelle (sólo si metodo === 'zelle'). */
  correo_zelle: string | null
}

export type DatosPagoMovil = {
  cuentas: CuentaCobro[]
  /** Instrucciones opcionales que verá el paciente en el paso de pago. */
  instrucciones: string | null
}

/**
 * Planes comerciales del tenant (definen precio, cupo de especialistas y flujo
 * de reserva):
 *  - `INDIVIDUAL` → 1 especialista (asignación automática en el wizard).
 *  - `PYME`       → 2 a 10 especialistas.
 *  - `PRO`        → 10+ especialistas o múltiples sedes.
 * Precios y cupos en `src/lib/suscripcion.ts` (migración 0020).
 */
export type PlanTenant = "INDIVIDUAL" | "PYME" | "PRO"

/* ------------------------ Landing Page del tenant ------------------------ */

/** Servicio / tratamiento destacado mostrado en la landing pública. */
export type LandingServicio = {
  titulo: string
  descripcion: string
}

/** Pregunta frecuente del perfil público. */
export type LandingFaq = {
  pregunta: string
  respuesta: string
}

/** Badges de autoridad/atención mostrados en el Hero. */
export type LandingBadges = {
  emergencias: boolean
  telemedicina: boolean
}

/** Contenido editable de la Landing Page (tenant.landing_config). */
export type LandingConfig = {
  hero_titulo: string | null
  hero_subtitulo: string | null
  sobre_nosotros: string | null
  horarios: string | null
  instagram: string | null
  facebook: string | null
  /** Subespecialidades o enfoque clínico. */
  subespecialidades: string | null
  /** N° MPPS / Registro Sanitario. */
  mpps: string | null
  /** N° de Colegio Médico. */
  colegio_medico: string | null
  /** Universidad / institución de egreso. */
  universidad: string | null
  /** Badges opcionales de atención. */
  badges: LandingBadges
  /** Dirección detallada del consultorio (piso, oficina, edificio). */
  direccion_detallada: string | null
  /** Punto de referencia de la ubicación. */
  punto_referencia: string | null
  /** Métodos de pago aceptados. */
  metodos_pago: string[]
  servicios: LandingServicio[]
  faq: LandingFaq[]
}

/** Configuración de tema/apariencia del perfil público (tenant.theme_config). */
export type ThemeConfig = {
  /** Color primario / acciones. */
  primaryColor: string
  /** Color secundario / badges. */
  secondaryColor: string
  /** Fondo de la página pública. */
  backgroundColor: string
  /** Fondo de tarjetas/módulos. */
  cardBackgroundColor: string
  /** Texto dentro de los botones principales. */
  buttonTextColor: string
}

/* ------------------------------------------------------------------ */
/* Enums del módulo de administración (fiscal / multimoneda)           */
/* ------------------------------------------------------------------ */

/** Tipo de documento fiscal venezolano (persona natural o jurídica). */
export type TipoDocumentoFiscal = "V" | "E" | "J" | "G" | "P"

/** Monedas soportadas por el motor de tasa oficial (BCV). */
export type CurrencyCode = "USD" | "VES"

/** Forma de reparto del honorario médico por servicio. */
export type DoctorCommissionType = "PERCENTAGE" | "FIXED"

export type Tenant = {
  id: string
  slug: string
  nombre: string
  logo_url: string | null
  /** Opcional según esquema: teléfono institucional / WhatsApp. */
  telefono?: string | null
  /** Opcional según esquema: dirección física de la clínica. */
  direccion?: string | null
  /** Opcional según esquema: RIF / cédula jurídica. */
  rif?: string | null
  /* ------------------- Módulo de Administración (0016) ------------------- */
  /** Razón social registrada ante el SENIAT (ej. "IBEARTS, C.A."). */
  razon_social?: string | null
  /** Domicilio fiscal declarado ante el SENIAT. */
  domicilio_fiscal?: string | null
  /** Correo para el envío de facturas/notas de crédito. */
  email_fiscal?: string | null
  /** Imprenta autorizada por el SENIAT (formas libres). */
  imprenta_autorizada?: string | null
  /** Número de providencia que autoriza las formas libres. */
  providencia_formas_libres?: string | null
  /* ---------------------------------------------------------------------- */
  /** Switch para habilitar/pausar Pago Móvil en línea en el wizard. */
  pago_movil_enabled?: boolean | null
  /** Límite máximo de cupos por turno; null/0 = ilimitado. */
  max_slots_per_shift?: number | null
  /** Plan comercial: Individual (1), PyME (2-10) o PRO (10+ / multi-sede). */
  plan_type?: PlanTenant | null
  /** Máximo de especialistas permitidos según el plan. */
  max_especialistas?: number | null
  /** Fecha/hora de vencimiento de la membresía (suscripción del SaaS). */
  suscripcion_vence_at?: string | null
  /** Switch de la Landing Page pública (/{slug}). */
  landing_enabled?: boolean | null
  /** Contenido editable de la Landing Page. */
  landing_config?: LandingConfig | null
  /** Apariencia del perfil público (colores). */
  theme_config?: ThemeConfig | null
  is_active: boolean
  datos_pago_movil: DatosPagoMovil | null
  created_at: string
}

export type TenantInsert = Omit<Tenant, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type TenantUpdate = Partial<TenantInsert>

/* ------------------------------------------------------------------ */
/* profiles (pacientes)                                                */
/* ------------------------------------------------------------------ */

export type Profile = {
  id: string
  tenant_id: string
  /** Titular de la cuenta; null para registros creados por invitado. */
  user_id: string | null
  nombres: string
  apellidos: string
  cedula: string | null
  telefono: string | null
  email: string | null
  /** 'YYYY-MM-DD'. */
  fecha_nacimiento: string | null
  es_menor: boolean
  /** Indica si esta fila es el titular (perfil principal) de la cuenta. */
  es_titular: boolean
  /** p. ej. 'hijo/a', 'esposo/a', 'padre', 'madre' para familiares. */
  parentesco: string | null
  /* ------------------- Directorio fiscal (0016) ------------------- */
  /** 'V' | 'E' | 'J' | 'G' | 'P' (persona natural o jurídica). */
  tipo_documento?: TipoDocumentoFiscal | null
  /** Cédula o RIF sin separadores (ej. 'V12345678', 'J123456789'). */
  documento_identidad?: string | null
  /** Nombre o razón social a facturar. */
  razon_social?: string | null
  /** Dirección fiscal del cliente para la factura. */
  direccion_fiscal?: string | null
  /* ---------------------------------------------------------------- */
  created_at: string
}


export type ProfileInsert = Omit<Profile, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type ProfileUpdate = Partial<ProfileInsert>

/* ------------------------------------------------------------------ */
/* doctors                                                             */
/* ------------------------------------------------------------------ */

export type TurnoHabitualEspecialista = "manana" | "tarde" | "ambos"

export type Doctor = {
  id: string
  tenant_id: string
  nombres: string
  apellidos: string
  /** Nombre completo en una sola columna (cuando el esquema lo usa). */
  nombre?: string | null
  /** Especialidad principal. */
  especialidad: string
  /** Especialidades adicionales / badges mostrados en la tarjeta. */
  especialidades: string[]
  /** Cédula / número de colegiado del especialista. */
  cedula?: string | null
  telefono?: string | null
  foto_url: string | null
  /** Precio de consulta en bolívares (VES) o divisa según tenant. */
  precio_consulta: number
  /** Días de atención (1=Lunes … 6=Sábado). */
  dias_atencion?: number[] | null
  /** Turno habitual por defecto. */
  turno_habitual?: TurnoHabitualEspecialista | null
  activo: boolean
  is_active?: boolean | null
  created_at: string
}

export type DoctorInsert = Omit<
  Doctor,
  | "id"
  | "created_at"
  | "especialidades"
  | "activo"
  | "nombres"
  | "apellidos"
  | "precio_consulta"
  | "foto_url"
> & {
  id?: string
  created_at?: string
  especialidades?: string[]
  activo?: boolean
  nombres?: string
  apellidos?: string
  foto_url?: string | null
  precio_consulta?: number
}

export type DoctorUpdate = Partial<DoctorInsert>

/* ------------------------------------------------------------------ */
/* schedules                                                           */
/* ------------------------------------------------------------------ */

export type Schedule = {
  id: string
  tenant_id: string
  doctor_id: string
  /** 0=Domingo … 6=Sábado. */
  dia_semana: number
  /** 'HH:mm' (hora inicial de la jornada). */
  hora_inicio: string
  /** 'HH:mm' (hora final, no inclusiva). */
  hora_fin: string
  /** Duración de cada cupo en minutos (p. ej. 30). */
  duracion_min: number
  activo: boolean
}

export type ScheduleInsert = Omit<Schedule, "id" | "activo"> & {
  id?: string
  activo?: boolean
}

export type ScheduleUpdate = Partial<ScheduleInsert>

/* ------------------------------------------------------------------ */
/* medical_records (expediente clínico de portales)                    */
/* ------------------------------------------------------------------ */

export type MedicalRecord = {
  id: string
  tenant_id: string
  appointment_id: string
  patient_id: string
  doctor_id: string
  motivo: string | null
  diagnostico: string | null
  tratamiento: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export type MedicalRecordInsert = Omit<
  MedicalRecord,
  "id" | "created_at" | "updated_at"
> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type MedicalRecordUpdate = Partial<MedicalRecordInsert>

/* ------------------------------------------------------------------ */
/* bcv_rates (tasa oficial del Banco Central de Venezuela)             */
/* ------------------------------------------------------------------ */

export type BcvRate = {
  id: string
  /** Fecha de la tasa ('YYYY-MM-DD'). */
  fecha: string
  /** Bolívares por 1 USD. */
  tasa: number
  /** Momento en que se publicó/consultó la tasa. */
  fetched_at: string
  fuente: string
}

export type BcvRateInsert = Omit<BcvRate, "id" | "fetched_at"> & {
  id?: string
  fetched_at?: string
}

/* ------------------------------------------------------------------ */
/* saas_subscription_payments (cobro de la membresía del SaaS)         */
/* ------------------------------------------------------------------ */

export type SubscriptionPaymentStatus = "PENDIENTE" | "APROBADO" | "RECHAZADO"

export type SaasSubscriptionPayment = {
  id: string
  tenant_id: string
  /** Plan facturado: INDIVIDUAL · PYME · PRO (ver migración 0020). */
  plan_type: PlanTenant
  monto_usd: number
  monto_ves: number
  tasa_bcv: number
  banco_origen: string | null
  referencia_pago: string
  telefono_emisor: string | null
  comprobante_url: string | null
  estado: SubscriptionPaymentStatus
  nota: string | null
  aprobado_por: string | null
  aprobado_at: string | null
  created_at: string
  updated_at: string
}

export type SaasSubscriptionPaymentInsert = Omit<
  SaasSubscriptionPayment,
  "id" | "created_at" | "updated_at" | "estado" | "nota" | "aprobado_por" | "aprobado_at"
> & {
  id?: string
  created_at?: string
  updated_at?: string
  estado?: SubscriptionPaymentStatus
  nota?: string | null
  aprobado_por?: string | null
  aprobado_at?: string | null
}

export type SaasSubscriptionPaymentUpdate =
  Partial<SaasSubscriptionPaymentInsert>

/* ------------------------------------------------------------------ */
/* appointments (reservas + lock de 15 min)                            */
/* ------------------------------------------------------------------ */

export type Appointment = {
  id: string
  tenant_id: string
  doctor_id: string
  /** Puede ser null si el cupo se reserva sin perfil (invitado). */
  patient_id: string | null
  /** ISO 8601 con offset (fecha_hora en hora local del tenant), p. ej. '2026-09-02T08:00:00-04:00'. */
  fecha_hora: string
  estado: AppointmentStatus
  lock_expira_en: string | null
  /** Turno elegido ('manana' | 'tarde'). Columna opcional según migración. */
  turno?: "manana" | "tarde" | null
  /** Hora referencial del turno ('08:00' o '13:00'). Columna opcional según migración. */
  hora?: string | null
  referencia_pago: string | null
  /** Opcional según migración: teléfono desde el que el paciente hizo el Pago Móvil. */
  telefono_emisor?: string | null
  /** Opcional según migración: banco de origen de la transferencia. */
  banco_origen?: string | null
  comprobante_url: string | null
  /** Método con el que se cobró en caja (efectivo/punto/pago móvil). */
  payment_method?: "efectivo" | "punto" | "pago_movil" | null
  /** Nota interna de la recepción (columna `nota`, si existe). */
  nota?: string | null
  created_at: string
}

export type AppointmentInsert = Omit<
  Appointment,
  | "id"
  | "created_at"
  | "estado"
  | "lock_expira_en"
  | "referencia_pago"
  | "telefono_emisor"
  | "banco_origen"
  | "comprobante_url"
> & {
  id?: string
  created_at?: string
  patient_id?: string | null
  estado?: AppointmentStatus
  lock_expira_en?: string | null
  referencia_pago?: string | null
  telefono_emisor?: string | null
  banco_origen?: string | null
  comprobante_url?: string | null
}

export type AppointmentUpdate = Partial<AppointmentInsert>

/* ------------------------------------------------------------------ */
/* tenant_users (staff multi-tenant)                                   */
/* ------------------------------------------------------------------ */

/**
 * Roles del personal de una clínica.
 * - `especialista`: rol histórico (equivale a `medico`, se conserva como alias).
 * - `medico`: nomenclatura del módulo de administración.
 * - `contador`: acceso de solo lectura financiera/fiscal.
 */
export type TenantUserRole =
  | "admin"
  | "recepcion"
  | "especialista"
  | "medico"
  | "contador"

export type TenantUser = {
  id: string
  tenant_id: string
  /** Usuario de Supabase Auth (auth.users.id). */
  user_id: string
  role: TenantUserRole
  /**
   * Sedes asignadas al usuario (`tenant_users.sede_ids`).
   * Arreglo vacío/ausente = acceso a todas las sedes del tenant.
   * Opcional: instalaciones sin la migración 0016 no tienen la columna.
   */
  sede_ids?: string[] | null
  /** Precio de consulta por usuario (usado en el Plan PRO). */
  precio_consulta?: number | null
  created_at: string
}


export type TenantUserInsert = Omit<TenantUser, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export type TenantUserUpdate = Partial<TenantUserInsert>

/* ------------------------------------------------------------------ */
/* guide_pages (Guía de Uso y Configuración / Base de conocimiento)   */
/* ------------------------------------------------------------------ */

export type GuidePage = {
  id: string
  slug: string
  title: string
  category: string
  order_index: number
  content_markdown: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export type GuidePageInsert = Omit<
  GuidePage,
  "id" | "created_at" | "updated_at" | "is_published" | "order_index" | "category"
> & {
  id?: string
  created_at?: string
  updated_at?: string
  is_published?: boolean
  order_index?: number
  category?: string
}

export type GuidePageUpdate = Partial<GuidePageInsert>

/* ------------------------------------------------------------------ */
/* currency_rates (motor de tasa oficial BCV y multimoneda)            */
/* ------------------------------------------------------------------ */

/**
 * Fila de `currency_rates` (CurrencyRate del módulo de administración).
 * `source = 'MANUAL'` indica una sobreescritura del administrador.
 */
export type CurrencyRate = {
  id: string
  currency: CurrencyCode
  rate: number
  /** 'YYYY-MM-DD' de vigencia de la tasa. */
  effective_date: string
  /** Fuente de la tasa: 'BCV' (automática) o 'MANUAL' (admin). */
  source: string
  /** Si es true, la plataforma refresca la tasa desde el BCV cada día. */
  auto_update: boolean
  /** Usuario que registró la tasa manual (null si fue automática). */
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CurrencyRateInsert = Omit<
  CurrencyRate,
  "id" | "created_at" | "updated_at" | "created_by" | "source" | "auto_update"
> & {
  id?: string
  created_at?: string
  updated_at?: string
  created_by?: string | null
  source?: string
  auto_update?: boolean
}

export type CurrencyRateUpdate = Partial<CurrencyRateInsert>

/* ------------------------------------------------------------------ */
/* sedes (estructura multi-sede del tenant)                            */
/* ------------------------------------------------------------------ */

export type Sede = {
  id: string
  tenant_id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  /** Sede por defecto del tenant (facturación / agenda). */
  es_principal: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export type SedeInsert = Omit<Sede, "id" | "created_at" | "updated_at"> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type SedeUpdate = Partial<SedeInsert>

/* ------------------------------------------------------------------ */
/* medical_services (catálogo de servicios y honorarios médicos)       */
/* ------------------------------------------------------------------ */

export type MedicalService = {
  id: string
  tenant_id: string
  /** Nombre del servicio (ej. "Consulta Cardiología General"). */
  title: string
  /** Código interno o de procedimiento (único por tenant). */
  code: string
  price_usd: number
  /** true = aplica IVA (16%); false = exento (servicios médicos directos). */
  taxable: boolean
  doctor_commission_type: DoctorCommissionType
  doctor_commission_value: number
  /** Especialista asociado (opcional). */
  doctor_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type MedicalServiceInsert = Omit<
  MedicalService,
  | "id"
  | "created_at"
  | "updated_at"
  | "taxable"
  | "doctor_commission_type"
  | "doctor_commission_value"
  | "doctor_id"
  | "activo"
> & {
  id?: string
  created_at?: string
  updated_at?: string
  taxable?: boolean
  doctor_commission_type?: DoctorCommissionType
  doctor_commission_value?: number
  doctor_id?: string | null
  activo?: boolean
}

export type MedicalServiceUpdate = Partial<MedicalServiceInsert>

/* ------------------------------------------------------------------ */
/* Módulo 2 · Facturación y cobros (Venezuela / SENIAT)                */
/* ------------------------------------------------------------------ */

/** Ciclo de vida de una factura. */
export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED"

/** Estado de cobro derivado de los pagos verificados. */
export type InvoicePaymentStatus = "PENDING" | "PARTIAL" | "PAID"

/** Métodos de cobro soportados por la caja venezolana. */
export type PaymentMethod =
  | "PAGO_MOVIL"
  | "ZELLE"
  | "TRANSFERENCIA_VES"
  | "EFECTIVO_USD"
  | "EFECTIVO_VES"
  | "PUNTO_DE_VENTA"

/** Verificación de un cobro por la recepción. */
export type PaymentStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"

/** Tipos de documento con numeración fiscal propia. */
export type FiscalDocType = "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE"

/** Snapshot fiscal del cliente guardado en la factura (jsonb). */
export type InvoiceFiscalProfile = {
  tipoDocumento: TipoDocumentoFiscal
  /** Cédula/RIF normalizado (ej. `V-12345678` / `J-40123456-7`). */
  documentoIdentidad: string
  razonSocial: string
  direccionFiscal: string
  email?: string | null
  telefono?: string | null
  /** Nombre del paciente al momento de la venta (solo informativo). */
  pacienteNombre?: string | null
}

/* ------------------- fiscal_counters (punteros) ------------------- */

export type FiscalCounter = {
  id: string
  tenant_id: string
  /** null = serie única de la clínica (sin separar por sede). */
  sede_id: string | null
  doc_type: FiscalDocType
  series: string
  next_invoice_number: number
  next_control_number: number
  invoice_prefix: string
  control_prefix: string
  created_at: string
  updated_at: string
}

export type FiscalCounterInsert = {
  id?: string
  tenant_id: string
  sede_id?: string | null
  doc_type?: FiscalDocType
  series?: string
  next_invoice_number?: number
  next_control_number?: number
  invoice_prefix?: string
  control_prefix?: string
  created_at?: string
  updated_at?: string
}

export type FiscalCounterUpdate = Partial<FiscalCounterInsert>

/* --------------------------- invoices --------------------------- */

export type Invoice = {
  id: string
  tenant_id: string
  sede_id: string | null
  /** Correlativo SENIAT (null mientras es borrador). */
  invoice_number: string | null
  /** N° de control de formas libres (null mientras es borrador). */
  control_number: string | null
  patient_id: string | null
  appointment_id: string | null
  fiscal_profile: InvoiceFiscalProfile | Record<string, unknown>
  subtotal_usd: number
  subtotal_ves: number
  vat_amount_usd: number
  vat_amount_ves: number
  igtf_amount_usd: number
  igtf_amount_ves: number
  total_usd: number
  total_ves: number
  bcv_rate_used: number
  status: InvoiceStatus
  payment_status: InvoicePaymentStatus
  notes: string | null
  created_by: string | null
  issued_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type InvoiceInsert = {
  id?: string
  tenant_id: string
  bcv_rate_used: number
  sede_id?: string | null
  invoice_number?: string | null
  control_number?: string | null
  patient_id?: string | null
  appointment_id?: string | null
  fiscal_profile?: InvoiceFiscalProfile | Record<string, unknown>
  subtotal_usd?: number
  subtotal_ves?: number
  vat_amount_usd?: number
  vat_amount_ves?: number
  igtf_amount_usd?: number
  igtf_amount_ves?: number
  total_usd?: number
  total_ves?: number
  status?: InvoiceStatus
  payment_status?: InvoicePaymentStatus
  notes?: string | null
  created_by?: string | null
  issued_at?: string | null
  cancelled_at?: string | null
  created_at?: string
  updated_at?: string
}

export type InvoiceUpdate = Partial<InvoiceInsert>

/* ------------------------- invoice_items ------------------------- */

export type InvoiceItem = {
  id: string
  invoice_id: string
  tenant_id: string
  service_id: string | null
  description: string
  quantity: number
  unit_price_usd: number
  unit_price_ves: number
  taxable: boolean
  doctor_id: string | null
  doctor_commission_amount: number
  created_at: string
}

export type InvoiceItemInsert = {
  id?: string
  invoice_id: string
  tenant_id: string
  description: string
  service_id?: string | null
  quantity?: number
  unit_price_usd?: number
  unit_price_ves?: number
  taxable?: boolean
  doctor_id?: string | null
  doctor_commission_amount?: number
  created_at?: string
}

export type InvoiceItemUpdate = Partial<InvoiceItemInsert>

/* ---------------------------- payments ---------------------------- */

export type Payment = {
  id: string
  invoice_id: string
  tenant_id: string
  sede_id: string | null
  method: PaymentMethod
  amount_usd: number
  amount_ves: number
  reference_number: string | null
  applies_igtf: boolean
  igtf_amount: number
  igtf_amount_ves: number
  status: PaymentStatus
  notes: string | null
  verified_by: string | null
  verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PaymentInsert = {
  id?: string
  invoice_id: string
  tenant_id: string
  method: PaymentMethod
  sede_id?: string | null
  amount_usd?: number
  amount_ves?: number
  reference_number?: string | null
  applies_igtf?: boolean
  igtf_amount?: number
  igtf_amount_ves?: number
  status?: PaymentStatus
  notes?: string | null
  verified_by?: string | null
  verified_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export type PaymentUpdate = Partial<PaymentInsert>

/* ------------------ credit_notes / debit_notes ------------------ */

export type CreditNote = {
  id: string
  tenant_id: string
  invoice_id: string
  note_number: string | null
  control_number: string | null
  amount_usd: number
  amount_ves: number
  motivo: string
  reembolsada: boolean
  issued_by: string | null
  created_at: string
}

export type CreditNoteInsert = {
  id?: string
  tenant_id: string
  invoice_id: string
  note_number?: string | null
  control_number?: string | null
  amount_usd?: number
  amount_ves?: number
  motivo: string
  reembolsada?: boolean
  issued_by?: string | null
  created_at?: string
}

export type DebitNote = {
  id: string
  tenant_id: string
  invoice_id: string
  note_number: string | null
  control_number: string | null
  amount_usd: number
  amount_ves: number
  motivo: string
  issued_by: string | null
  created_at: string
}

export type DebitNoteInsert = {
  id?: string
  tenant_id: string
  invoice_id: string
  note_number?: string | null
  control_number?: string | null
  amount_usd?: number
  amount_ves?: number
  motivo: string
  issued_by?: string | null
  created_at?: string
}

/* ------------------------------------------------------------------ */
/* Módulo 3 · Contabilidad, libros fiscales y cuadre de caja           */
/* ------------------------------------------------------------------ */

/** Ciclo de vida del cierre/arqueo de caja. */
export type DailyClosingStatus = "OPEN" | "CLOSED" | "AUDITED"

/** Estado de una liquidación de honorarios. */
export type SettlementStatus = "PENDING" | "APPROVED" | "PAID"

/** Fila del desglose por método de cobro dentro de un arqueo (jsonb). */
export type ClosingMethodBreakdown = {
  method: PaymentMethod
  expectedUSD: number
  expectedVES: number
  countedUSD: number
  countedVES: number
  differenceUSD: number
  differenceVES: number
  /** Cantidad de cobros del sistema para ese método en la jornada. */
  operaciones: number
}

export type DailyClosing = {
  id: string
  tenant_id: string
  sede_id: string | null
  closing_date: string
  opened_by: string | null
  closed_by: string | null
  total_expected_usd: number
  total_expected_ves: number
  total_actual_usd: number
  total_actual_ves: number
  difference_usd: number
  difference_ves: number
  breakdown_by_method: ClosingMethodBreakdown[] | Record<string, unknown>
  status: DailyClosingStatus
  notes: string | null
  opened_at: string
  closed_at: string | null
  audited_by: string | null
  audited_at: string | null
  created_at: string
  updated_at: string
}

export type DailyClosingInsert = {
  id?: string
  tenant_id: string
  sede_id?: string | null
  closing_date?: string
  opened_by?: string | null
  closed_by?: string | null
  total_expected_usd?: number
  total_expected_ves?: number
  total_actual_usd?: number
  total_actual_ves?: number
  difference_usd?: number
  difference_ves?: number
  breakdown_by_method?: ClosingMethodBreakdown[] | Record<string, unknown>
  status?: DailyClosingStatus
  notes?: string | null
  opened_at?: string
  closed_at?: string | null
  audited_by?: string | null
  audited_at?: string | null
  created_at?: string
  updated_at?: string
}

export type DailyClosingUpdate = Partial<DailyClosingInsert>

export type DoctorSettlement = {
  id: string
  tenant_id: string
  doctor_id: string
  period_start: string
  period_end: string
  total_services_count: number
  gross_amount_usd: number
  commission_deducted_usd: number
  net_payable_usd: number
  net_payable_ves: number
  bcv_rate_used: number | null
  status: SettlementStatus
  payment_reference: string | null
  notes: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export type DoctorSettlementInsert = {
  id?: string
  tenant_id: string
  doctor_id: string
  period_start: string
  period_end: string
  total_services_count?: number
  gross_amount_usd?: number
  commission_deducted_usd?: number
  net_payable_usd?: number
  net_payable_ves?: number
  bcv_rate_used?: number | null
  status?: SettlementStatus
  payment_reference?: string | null
  notes?: string | null
  created_by?: string | null
  approved_by?: string | null
  approved_at?: string | null
  paid_by?: string | null
  paid_at?: string | null
  created_at?: string
  updated_at?: string
}

export type DoctorSettlementUpdate = Partial<DoctorSettlementInsert>

/* ------------------------------------------------------------------ */
/* Tipado del cliente Supabase (createClient<Database>)                */
/* ------------------------------------------------------------------ */

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: TenantInsert
        Update: TenantUpdate
        Relationships: []
      }
      tenant_users: {
        Row: TenantUser
        Insert: TenantUserInsert
        Update: TenantUserUpdate
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      doctors: {
        Row: Doctor
        Insert: DoctorInsert
        Update: DoctorUpdate
        Relationships: []
      }
      schedules: {
        Row: Schedule
        Insert: ScheduleInsert
        Update: ScheduleUpdate
        Relationships: []
      }
      appointments: {
        Row: Appointment
        Insert: AppointmentInsert
        Update: AppointmentUpdate
        Relationships: []
      }
      bcv_rates: {
        Row: BcvRate
        Insert: BcvRateInsert
        Update: Partial<BcvRateInsert>
        Relationships: []
      }
      medical_records: {
        Row: MedicalRecord
        Insert: MedicalRecordInsert
        Update: MedicalRecordUpdate
        Relationships: []
      }
      saas_subscription_payments: {
        Row: SaasSubscriptionPayment
        Insert: SaasSubscriptionPaymentInsert
        Update: SaasSubscriptionPaymentUpdate
        Relationships: []
      }
      guide_pages: {
        Row: GuidePage
        Insert: GuidePageInsert
        Update: GuidePageUpdate
        Relationships: []
      }
      currency_rates: {
        Row: CurrencyRate
        Insert: CurrencyRateInsert
        Update: CurrencyRateUpdate
        Relationships: []
      }
      sedes: {
        Row: Sede
        Insert: SedeInsert
        Update: SedeUpdate
        Relationships: []
      }
      medical_services: {
        Row: MedicalService
        Insert: MedicalServiceInsert
        Update: MedicalServiceUpdate
        Relationships: []
      }
      fiscal_counters: {
        Row: FiscalCounter
        Insert: FiscalCounterInsert
        Update: FiscalCounterUpdate
        Relationships: []
      }
      invoices: {
        Row: Invoice
        Insert: InvoiceInsert
        Update: InvoiceUpdate
        Relationships: []
      }
      invoice_items: {
        Row: InvoiceItem
        Insert: InvoiceItemInsert
        Update: InvoiceItemUpdate
        Relationships: []
      }
      payments: {
        Row: Payment
        Insert: PaymentInsert
        Update: PaymentUpdate
        Relationships: []
      }
      credit_notes: {
        Row: CreditNote
        Insert: CreditNoteInsert
        Update: Partial<CreditNoteInsert>
        Relationships: []
      }
      debit_notes: {
        Row: DebitNote
        Insert: DebitNoteInsert
        Update: Partial<DebitNoteInsert>
        Relationships: []
      }
      daily_closings: {
        Row: DailyClosing
        Insert: DailyClosingInsert
        Update: DailyClosingUpdate
        Relationships: []
      }
      doctor_settlements: {
        Row: DoctorSettlement
        Insert: DoctorSettlementInsert
        Update: DoctorSettlementUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

