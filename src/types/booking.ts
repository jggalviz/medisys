/**
 * MEDISYS · Tipos del flujo de reserva (Booking Wizard)
 * DTOs compartidos entre Server Actions (`src/app/actions/booking.ts`)
 * y los componentes cliente de `src/components/booking/*`.
 */
import type { Appointment, Doctor, Profile, Tenant } from "./database"

/** Códigos de error normalizados devueltos por las Server Actions. */
export type ActionErrorCode =
  | "NO_AUTH" // se requiere sesión
  | "NOT_FOUND" // tenant / doctor / paciente no existe o está inactivo
  | "INVALID_INPUT" // parámetros mal formados
  | "SLOT_UNAVAILABLE" // la hora ya fue bloqueada/reservada por otro
  | "LOCK_EXPIRED" // el lock de 15 min venció
  | "CONFLICT" // estado inconsistente (p. ej. cita ya pagada)
  | "SERVER_ERROR" // error inesperado

/** Envoltorio de respuesta de las Server Actions (serie, no excepciones). */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string }

/* ---------------- Paso 1 · Paciente ---------------- */

export type PatientOptions = {
  tenant: Pick<Tenant, "id" | "slug" | "nombre">
  profiles: Profile[]
  session: {
    isAuthenticated: boolean
    userId: string | null
  }
}

export type NewPatientInput = {
  nombres: string
  apellidos: string
  cedula?: string | null
  telefono?: string | null
  email?: string | null
  fecha_nacimiento?: string | null
  es_menor: boolean
  parentesco?: string | null
}

/* ---------------- Paso 2 · Doctor ---------------- */

export type DoctorWithTenant = Doctor & {
  tenant: { slug: string } | null
}

/* ---------------- Paso 3 · Fecha y hora ---------------- */

/** Cupo disponible generado a partir de la tabla `schedules`. */
export type AvailableSlot = {
  fecha: string // 'YYYY-MM-DD'
  hora: string // 'HH:mm'
  /** fecha + hora con offset -04:00, p. ej. '2026-09-02T08:00:00-04:00'. */
  iso: string
}

export type AvailableSlotsResult = {
  fecha: string
  slots: AvailableSlot[]
}

/* ---------------- Paso 4 · Pago ---------------- */

export type ConfirmPaymentInput = {
  appointmentId: string
  referenciaPago: string
  comprobanteUrl?: string | null
}

/** Payload con el que el Step 3 avisa al wizard del lock creado. */
export type LockCreated = {
  appointment: Appointment
  /** MS epoch en que expira el lock (now + 15 min). */
  expiresAt: number
}
