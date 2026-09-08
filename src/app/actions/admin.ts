"use server"

/**
 * MEDISYS · Server Actions del módulo de recepción.
 *
 *  - `getPendingPayments`   citas con pago en línea por validar.
 *  - `validatePayment`      aprueba (confirmada) o rechaza (pago_rechazado).
 *  - `getDailyAppointments` agenda del día (con filtros por doctor/turno).
 *
 * ⚠️ Seguridad: por ahora el `tenantId` llega como parámetro explícito. Antes
 * de producción hay que proteger estas acciones con la sesión del personal
 * (rol/RLS) para que cada clínica solo acceda a sus datos.
 *
 * Errores: se devuelven como `ActionResult` (serie, sin excepciones al UI).
 */
import type { Appointment, AppointmentStatus } from "@/types/database"
import type {
  AdminDoctor,
  AdminErrorCode,
  AdminPatient,
  AdminRawAppointment,
  ActionResult,
  DailyAppointmentItem,
  DailyAppointmentsQuery,
  EstadoRecepcion,
  MetodoCobroRecepcion,
  PendingPaymentItem,
  UpdateAppointmentStatusInput,
  ValidatePaymentInput,
} from "@/types/admin"
import { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/* ---------------------------- helpers ---------------------------- */

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

function err<T = never>(
  code: AdminErrorCode,
  message: string
): ActionResult<T> {
  return { ok: false, code, message }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function nullableStr(value: unknown): string | null {
  return value == null ? null : str(value)
}

/** Fecha siguiente 'YYYY-MM-DD' (para el filtro por rango del día). */
function siguienteDiaISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number)
  const date = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1, 12, 0, 0, 0)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function toISOConOffset(dateISO: string, hora: string): string {
  return `${dateISO}T${hora}:00-04:00`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateISO(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return value === `${yy}-${mm}-${dd}`
}

/** Normaliza una fila cruda de `appointments` tolerando columnas ausentes. */
function normalizeAppointment(row: Record<string, unknown>): AdminRawAppointment {
  const estado = row.estado as Appointment["estado"] | undefined
  const turno = row.turno
  return {
    id: str(row.id),
    doctor_id: str(row.doctor_id),
    patient_id: row.patient_id == null ? null : str(row.patient_id),
    fecha_hora: nullableStr(row.fecha_hora),
    estado: estado ?? "pendiente",
    lock_expira_en: nullableStr(row.lock_expira_en),
    turno: turno === "manana" || turno === "tarde" ? turno : null,
    referencia_pago: nullableStr(row.referencia_pago),
    telefono_emisor: nullableStr(row.telefono_emisor),
    banco_origen: nullableStr(row.banco_origen),
    comprobante_url: nullableStr(row.comprobante_url),
    created_at: nullableStr(row.created_at) ?? "",
  }
}

function normalizePatient(row: Record<string, unknown>): AdminPatient | null {
  if (!row.id) return null
  return {
    id: str(row.id),
    nombres: str(row.nombres) || "Sin nombre",
    apellidos: str(row.apellidos),
    cedula: nullableStr(row.cedula),
    telefono: nullableStr(row.telefono),
    email: nullableStr(row.email),
  }
}

function normalizeDoctor(row: Record<string, unknown>): AdminDoctor | null {
  if (!row.id) return null
  const nombres = str(row.nombres)
  const apellidos = str(row.apellidos)
  const nombreCompleto = str(row.nombre)
  let primerNombre = nombres
  let resto = apellidos
  if (!primerNombre && !resto && nombreCompleto) {
    const partes = nombreCompleto.split(/\s+/).filter(Boolean)
    primerNombre = partes.shift() ?? ""
    resto = partes.join(" ")
  }
  return {
    id: str(row.id),
    nombres: primerNombre || "Especialista",
    apellidos: resto,
    especialidad: str(row.especialidad) || "General",
  }
}

/** Hidrata pacientes y especialistas de una lista de citas. */
async function hidratarCitas(
  supabase: SupabaseClient,
  citas: AdminRawAppointment[]
): Promise<
  ActionResult<{ paciente: AdminPatient | null; especialista: AdminDoctor | null }[]>
> {
  const doctorIds = Array.from(new Set(citas.map((c) => c.doctor_id).filter(Boolean)))
  const patientIds = Array.from(
    new Set(citas.map((c) => c.patient_id).filter((p): p is string => p !== null))
  )

  const doctores = new Map<string, AdminDoctor>()
  const pacientes = new Map<string, AdminPatient>()

  if (doctorIds.length > 0) {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .in("id", doctorIds)
    if (error) return err("SERVER_ERROR", error.message)
    for (const row of (data ?? []) as unknown[]) {
      const doctor = normalizeDoctor(row as Record<string, unknown>)
      if (doctor) doctores.set(doctor.id, doctor)
    }
  }

  if (patientIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", patientIds)
    if (error) return err("SERVER_ERROR", error.message)
    for (const row of (data ?? []) as unknown[]) {
      const paciente = normalizePatient(row as Record<string, unknown>)
      if (paciente) pacientes.set(paciente.id, paciente)
    }
  }

  return ok(
    citas.map((cita) => ({
      paciente: cita.patient_id ? (pacientes.get(cita.patient_id) ?? null) : null,
      especialista: doctores.get(cita.doctor_id) ?? null,
    }))
  )
}

/* ------------------------------------------------------------------ */
/* Pagos pendientes de validación                                      */
/* ------------------------------------------------------------------ */

/** Citas con estado `pendiente_validacion` más sus datos completos. */
export async function getPendingPayments(
  tenantId: string
): Promise<ActionResult<PendingPaymentItem[]>> {
  try {
    if (!tenantId.trim()) {
      return err("INVALID_INPUT", "Indica el identificador de la clínica.")
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("estado", "pendiente_validacion")
      .order("created_at", { ascending: true })

    if (error) return err("SERVER_ERROR", error.message)

    const citas = ((data ?? []) as unknown[]).map((row) =>
      normalizeAppointment(row as Record<string, unknown>)
    )
    const hidratacion = await hidratarCitas(supabase, citas)
    if (!hidratacion.ok) return hidratacion

    return ok(
      citas.map((cita, index) => ({
        id: cita.id,
        doctor_id: cita.doctor_id,
        patient_id: cita.patient_id,
        fecha_hora: cita.fecha_hora ?? "",
        estado: cita.estado,
        lock_expira_en: cita.lock_expira_en,
        turno: cita.turno ?? null,
        referencia_pago: cita.referencia_pago ?? null,
        telefono_emisor: cita.telefono_emisor ?? null,
        banco_origen: cita.banco_origen ?? null,
        comprobante_url: cita.comprobante_url ?? null,
        created_at: cita.created_at,
        paciente: hidratacion.data[index]?.paciente ?? null,
        especialista: hidratacion.data[index]?.especialista ?? null,
      }))
    )
  } catch (cause) {
    const e = cause instanceof Error ? cause.message : "Error inesperado en el servidor."
    return err("SERVER_ERROR", e)
  }
}

/* ------------------------------------------------------------------ */
/* Validar / rechazar pago                                             */
/* ------------------------------------------------------------------ */

/**
 * Aprueba o rechaza un pago pendiente:
 *  - `approved: true`  → estado 'confirmada'.
 *  - `approved: false` → estado 'pago_rechazado' (libera el cupo).
 */
export async function validatePayment(
  input: ValidatePaymentInput
): Promise<ActionResult<{ id: string; estado: Appointment["estado"] }>> {
  try {
    const appointmentId = input.appointmentId?.trim()
    if (!appointmentId) return err("INVALID_INPUT", "Falta la cita a validar.")

    const supabase = await createClient()
    const { data: cita, error } = await supabase
      .from("appointments")
      .select("id, estado")
      .eq("id", appointmentId)
      .maybeSingle()

    if (error) return err("SERVER_ERROR", error.message)
    if (!cita) return err("NOT_FOUND", "La cita ya no existe.")

    if (cita.estado !== "pendiente_validacion") {
      return err(
        "CONFLICT",
        `Esta cita ya está en estado "${cita.estado}" y no admite validación.`
      )
    }

    const estado: Appointment["estado"] = input.approved
      ? "confirmada"
      : "pago_rechazado"
    const nota = input.note?.trim() || null

    const actualizar = async (payload: {
      estado: Appointment["estado"]
      nota?: string | null
    }) => {
      const primerIntento = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointmentId)
        .eq("estado", "pendiente_validacion")
        .select("id, estado")
        .single()

      // Esquema sin columna `nota` → reintento con solo el estado.
      if (primerIntento.error?.code === "PGRST204") {
        return supabase
          .from("appointments")
          .update({ estado: payload.estado })
          .eq("id", appointmentId)
          .eq("estado", "pendiente_validacion")
          .select("id, estado")
          .single()
      }
      return primerIntento
    }

    const { data: actualizada, error: updateError } = await actualizar(
      nota ? { estado, nota } : { estado }
    )
    if (updateError) return err("SERVER_ERROR", updateError.message)
    return ok(actualizada)
  } catch (cause) {
    const e = cause instanceof Error ? cause.message : "Error inesperado en el servidor."
    return err("SERVER_ERROR", e)
  }
}

/* ------------------------------------------------------------------ */
/* Agenda del día                                                      */
/* ------------------------------------------------------------------ */

const ORDEN_ESTADOS: AppointmentStatus[] = [
  "pendiente_validacion",
  "pago_en_recepcion",
  "confirmada",
  "en_espera",
  "en_consulta",
  "atendido",
  "pendiente",
  "completada",
  "cancelada",
  "pago_rechazado",
  "expirada",
]

/** Índice de orden para el sort (estados desconocidos van al final). */
function indiceEstado(estado: AppointmentStatus): number {
  const indice = ORDEN_ESTADOS.indexOf(estado)
  return indice === -1 ? 99 : indice
}

/** Citas de un día (rango `fecha_hora`), con filtros opcionales. */
export async function getDailyAppointments(
  query: DailyAppointmentsQuery
): Promise<ActionResult<DailyAppointmentItem[]>> {
  try {
    const { tenantId, date, doctorId, turno } = query
    if (!tenantId.trim() || !isValidDateISO(date)) {
      return err("INVALID_INPUT", "Parámetros de la consulta inválidos.")
    }

    const supabase = await createClient()

    let consulta = supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("fecha_hora", toISOConOffset(date, "00:00"))
      .lt("fecha_hora", toISOConOffset(siguienteDiaISO(date), "00:00"))

    if (doctorId) consulta = consulta.eq("doctor_id", doctorId)
    if (turno) consulta = consulta.eq("turno", turno)

    const { data, error } = await consulta
    if (error) return err("SERVER_ERROR", error.message)

    const citas = ((data ?? []) as unknown[])
      .map((row) => normalizeAppointment(row as Record<string, unknown>))
      .sort(
        (a, b) =>
          indiceEstado(a.estado) - indiceEstado(b.estado) ||
          (a.created_at ?? "").localeCompare(b.created_at ?? "")
      )

    const hidratacion = await hidratarCitas(supabase, citas)
    if (!hidratacion.ok) return hidratacion

    return ok(
      citas.map((cita, index) => ({
        id: cita.id,
        estado: cita.estado,
        fecha_hora: cita.fecha_hora ?? "",
        turno: cita.turno ?? null,
        created_at: cita.created_at,
        referencia_pago: cita.referencia_pago ?? null,
        comprobante_url: cita.comprobante_url ?? null,
        paciente: hidratacion.data[index]?.paciente ?? null,
        especialista: hidratacion.data[index]?.especialista ?? null,
      }))
    )
  } catch (cause) {
    const e = cause instanceof Error ? cause.message : "Error inesperado en el servidor."
    return err("SERVER_ERROR", e)
  }
}

/* ------------------------------------------------------------------ */
/* Cola del día (recepción)                                            */
/* ------------------------------------------------------------------ */

/** Estados a los que la recepción puede mover una cita. */
const ESTADOS_PERMITIDOS: EstadoRecepcion[] = [
  "confirmada",
  "en_espera",
  "en_consulta",
  "atendido",
]

const METODOS_PERMITIDOS: MetodoCobroRecepcion[] = [
  "efectivo",
  "punto",
  "pago_movil",
]

/**
 * Actualiza el estado de una cita dentro de la cola del día.
 * Sirve para: cobrar en caja (→ confirmada o en_espera), marcar llegada
 * (→ en_espera), llamar a consulta (→ en_consulta) y finalizar (→ atendido).
 */
export async function updateAppointmentStatus(
  input: UpdateAppointmentStatusInput
): Promise<ActionResult<{ id: string; estado: Appointment["estado"] }>> {
  try {
    const appointmentId = input.appointmentId?.trim()
    if (!appointmentId) return err("INVALID_INPUT", "Falta la cita a actualizar.")

    if (!ESTADOS_PERMITIDOS.includes(input.status)) {
      return err("INVALID_INPUT", "El estado solicitado no es válido.")
    }

    const metodo = input.paymentMethod ?? null
    if (metodo && !METODOS_PERMITIDOS.includes(metodo)) {
      return err("INVALID_INPUT", "El método de pago indicado no es válido.")
    }
    if (metodo && input.status !== "confirmada" && input.status !== "en_espera") {
      return err(
        "INVALID_INPUT",
        "El método de pago solo aplica al cobrar en caja."
      )
    }

    const supabase = await createClient()
    const { data: cita, error } = await supabase
      .from("appointments")
      .select("id, estado")
      .eq("id", appointmentId)
      .maybeSingle()

    if (error) return err("SERVER_ERROR", error.message)
    if (!cita) return err("NOT_FOUND", "La cita ya no existe.")

    if (cita.estado === "atendido" || cita.estado === "completada") {
      return err("CONFLICT", "Esta cita ya fue finalizada.")
    }

    const estado = input.status
    const actualizar = async (payload: {
      estado: Appointment["estado"]
      payment_method?: MetodoCobroRecepcion | null
    }) => {
      const primerIntento = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointmentId)
        .select("id, estado")
        .single()

      // Esquema sin columna `payment_method` → reintento con solo estado.
      if (primerIntento.error?.code === "PGRST204") {
        return supabase
          .from("appointments")
          .update({ estado: payload.estado })
          .eq("id", appointmentId)
          .select("id, estado")
          .single()
      }
      return primerIntento
    }

    const { data: actualizada, error: updateError } = await actualizar(
      metodo ? { estado, payment_method: metodo } : { estado }
    )
    if (updateError) return err("SERVER_ERROR", updateError.message)
    return ok(actualizada)
  } catch (cause) {
    const e = cause instanceof Error ? cause.message : "Error inesperado en el servidor."
    return err("SERVER_ERROR", e)
  }
}