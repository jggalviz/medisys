/**
 * MEDISYS · Tipos del módulo administrativo (recepción / verificación de pagos)
 * DTOs compartidos entre las Server Actions de `src/app/actions/admin.ts`
 * y la UI de `src/app/[clinicSlug]/admin/*`.
 */
import type { Appointment, AppointmentStatus, DatosPagoMovil, Doctor, Profile, Tenant } from "./database"
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
