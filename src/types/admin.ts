/**
 * MEDISYS · Tipos del módulo administrativo (recepción / verificación de pagos)
 * DTOs compartidos entre las Server Actions de `src/app/actions/admin.ts`
 * y la UI de `src/app/[clinicSlug]/admin/*`.
 */
import type {
  Appointment,
  AppointmentStatus,
  CurrencyCode,
  DatosPagoMovil,
  Doctor,
  DoctorCommissionType,
  Profile,
  Tenant,
  ThemeConfig,
} from "./database"
import type { TurnoSeleccionado } from "./booking"

/* -------------------- Resultado de Server Action -------------------- */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AdminErrorCode; message: string }

export type AdminErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT" // la cita ya no está pendiente de validación
  | "SERVER_ERROR"

/* --------------------- Pagos pendientes (Paso 4) --------------------- */

/** Datos del paciente mostrados en recepción. */
export type AdminPatient = Pick<
  Profile,
  "id" | "nombres" | "apellidos" | "cedula" | "telefono" | "email"
>

/** Datos del especialista mostrados en recepción. */
export type AdminDoctor = Pick<
  Doctor,
  "id" | "nombres" | "apellidos" | "especialidad"
>

export type PendingPaymentItem = {
  id: string
  doctor_id: string
  patient_id: string | null
  fecha_hora: string
  estado: AppointmentStatus
  lock_expira_en: string | null
  turno: TurnoSeleccionado | null
  referencia_pago: string | null
  telefono_emisor: string | null
  banco_origen: string | null
  comprobante_url: string | null
  created_at: string
  paciente: AdminPatient | null
  especialista: AdminDoctor | null
}

/** Cita del día para la agenda de recepción. */
export type DailyAppointmentItem = {
  id: string
  estado: AppointmentStatus
  fecha_hora: string
  turno: TurnoSeleccionado | null
  created_at: string
  referencia_pago: string | null
  comprobante_url: string | null
  paciente: AdminPatient | null
  especialista: AdminDoctor | null
}

/* --------------------------- Entradas --------------------------- */

export type ValidatePaymentInput = {
  appointmentId: string
  /** true → confirma la cita; false → rechaza el pago. */
  approved: boolean
  /** Nota interna opcional (columna `nota`, si el esquema la tiene). */
  note?: string | null
}

export type DailyAppointmentsQuery = {
  tenantId: string
  /** Fecha del día 'YYYY-MM-DD'. */
  date: string
  doctorId?: string | null
  turno?: TurnoSeleccionado | null
}

/** Métodos aceptados al cobrar en caja (recepción). */
export type MetodoCobroRecepcion = "efectivo" | "punto" | "pago_movil"

/** Estados a los que la recepción puede mover una cita en el día. */
export const ESTADOS_RECEPCION = [
  "confirmada",
  "en_espera",
  "en_consulta",
  "atendido",
] as const
export type EstadoRecepcion = (typeof ESTADOS_RECEPCION)[number]

export type UpdateAppointmentStatusInput = {
  appointmentId: string
  status: EstadoRecepcion
  /** Solo aplica al cobrar en caja (confirmada/en_espera). */
  paymentMethod?: MetodoCobroRecepcion | null
}

/* ----------------- Configuración del tenant ----------------- */

/** Datos operativos editables del tenant (sección /admin/configuracion). */
export type TenantSettingsData = {
  nombre: string
  rif?: string | null
  direccion?: string | null
  telefono?: string | null
  /** Switch que habilita/pausa la pasarela de Pago Móvil en línea. */
  pago_movil_enabled: boolean
  /** Límite por turno; null o 0 = ilimitado. */
  max_slots_per_shift: number | null
  datos_pago_movil: DatosPagoMovil | null
  /** Paleta del perfil público (colores). */
  theme_config: ThemeConfig
}

export type UpdateTenantSettingsInput = {
  /** Identificador UUID del tenant (rutas admin actuales). */
  tenantId?: string | null
  /** Slug alternativo (ej. "clinica-demo"); se resuelve su `id` por consulta. */
  clinicSlug?: string | null
  data: TenantSettingsData
}

export type TenantSettingsResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type TenantSettingsOutput = { tenant: Tenant }

/** Referencia de fila cruda de `appointments` (para tolerar columnas ausentes). */
export type AdminRawAppointment = {
  id: string
  doctor_id: string
  patient_id: string | null
  fecha_hora: string | null
  estado: Appointment["estado"]
  lock_expira_en: string | null
  turno?: "manana" | "tarde" | null
  referencia_pago?: string | null
  telefono_emisor?: string | null
  banco_origen?: string | null
  comprobante_url?: string | null
  created_at: string
}

/* ==================================================================== */
/* MÓDULO DE ADMINISTRACIÓN · Facturación, multimoneda, sedes y catálogo */
/* ==================================================================== */

/** Códigos de error compartidos por los servicios y las API del módulo. */
export type AdminModuleErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  /** La migración 0016 aún no se aplicó en la base de datos. */
  | "MIGRACION_PENDIENTE"
  | "SERVER_ERROR"

/** Incidencia de validación asociada a un campo del formulario. */
export type CampoIssue = { campo: string; mensaje: string }

/** Resultado uniforme de los servicios del módulo de administración. */
export type AdminModuleResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: AdminModuleErrorCode
      message: string
      issues?: CampoIssue[]
    }

/* ------------------- 1. Entidad fiscal del tenant ------------------- */

/** Domicilio fiscal y datos corporativos para la facturación SENIAT. */
export type EntidadFiscal = {
  tenantId: string
  /** Razón social registrada ante el SENIAT (ej. "IBEARTS, C.A."). */
  razonSocial: string
  /** RIF en formato canónico `V-00000000-0`. */
  rif: string
  /** Domicilio fiscal declarado ante el SENIAT. */
  domicilioFiscal: string
  telefonoContacto: string | null
  emailFiscal: string | null
  /** Imprenta autorizada para formas libres (opcional). */
  imprentaAutorizada: string | null
  /** Número de providencia de las formas libres (opcional). */
  providenciaFormasLibres: string | null
  /** Nombre comercial del tenant (perfil público / reservas). */
  nombreComercial: string
  /** Slug de la clínica (rutas). */
  clinicSlug: string
}

/* ------------------- 2. Motor de tasa BCV ------------------- */

/** Origen efectivo de la tasa entregada al consumidor. */
export type OrigenTasa = "manual" | "bcv" | "respaldo"

export type TasaBcv = {
  currency: CurrencyCode
  rate: number
  /** 'YYYY-MM-DD' de vigencia. */
  effectiveDate: string
  /** 'BCV' | 'MANUAL' | fuente externa reportada por el scraper. */
  source: string
  /** Switch de actualización automática diaria desde el BCV. */
  autoUpdate: boolean
  origen: OrigenTasa
  /** Descripción legible de dónde salió la tasa (UI/logs). */
  detalle: string
  /** Fecha/hora ISO de la última persistencia conocida. */
  actualizadoEn: string | null
}

/** Registro histórico de una tasa (auditoría del motor multimoneda). */
export type TasaRegistro = {
  id: string
  currency: CurrencyCode
  rate: number
  /** 'YYYY-MM-DD' de vigencia. */
  effectiveDate: string
  source: string
  autoUpdate: boolean
  actualizadoEn: string | null
}

/* ------------------- 3. Sedes (multi-sede / RBAC) ------------------- */

export type SedeDTO = {
  id: string
  tenantId: string
  nombre: string
  direccion: string | null
  telefono: string | null
  esPrincipal: boolean
  activo: boolean
  createdAt: string
}

/* ------------------- 4. Catálogo de servicios médicos ------------------- */

export type ServicioMedicoDTO = {
  id: string
  tenantId: string
  title: string
  code: string
  priceUSD: number
  taxable: boolean
  doctorCommissionType: DoctorCommissionType
  doctorCommissionValue: number
  doctorId: string | null
  activo: boolean
  createdAt: string
}

