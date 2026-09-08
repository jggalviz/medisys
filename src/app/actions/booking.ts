"use server"

/**
 * MEDISYS · Server Actions del flujo de reserva (Booking Wizard)
 * -----------------------------------------------------------------
 * Toda la lógica de negocio sensible corre en el servidor con el
 * cliente Supabase `@/lib/supabase/server` (sesión vía cookies).
 *
 *  - `getDoctorsByTenant`      especialidades/especialistas públicos del tenant
 *  - `getAvailableSlots`       cupos del día a partir de `schedules`
 *  - `lockAppointmentSlot`     crea cita 'pendiente' con lock de 15 min
 *  - `registerAppointmentPayment` registra el método de pago elegido
 *    (en línea con comprobante o pago en recepción)
 *  - `releaseLockedSlot`       libera el lock al vencer / al retroceder
 *
 * Errores: nunca se lanzan excepciones al cliente; se devuelve
 * `ActionResult<T>` con códigos accionables por la UI.
 */
import { LOCK_DURATION_MINUTES } from "@/types/database"
import type { Appointment, AppointmentUpdate, Doctor, Profile } from "@/types/database"
import type {
  ActionResult,
  AvailableSlot,
  AvailableSlotsResult,
  DoctorSchedule,
  DoctorWithTenant,
  NewPatientInput,
  PatientOptions,
  PaymentMethodInput,
  TurnoSeleccionado,
} from "@/types/booking"
import { createClient } from "@/lib/supabase/server"
import {
  combineToISO,
  isValidDateISO,
  isValidTime,
  minutesToTime,
  parseDateISO,
  timeToMinutes,
  toISODate,
} from "@/lib/date"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type OkResult<T> = Extract<ActionResult<T>, { ok: true }>
type ErrResult<T> = Extract<ActionResult<T>, { ok: false }>

function ok<T>(data: T): OkResult<T> {
  return { ok: true, data }
}

function err<T = never>(
  code: ErrResult<T>["code"],
  message: string
): ErrResult<T> {
  return { ok: false, code, message }
}

function unknownError(cause: unknown): { code: "SERVER_ERROR"; message: string } {
  const message =
    cause instanceof Error ? cause.message : "Error inesperado en el servidor."
  return { code: "SERVER_ERROR", message }
}

/** Busca el tenant público activo por slug (id/slug/nombre). */
async function findActiveTenant(
  supabase: SupabaseClient,
  slug: string
): Promise<ActionResult<{ id: string; slug: string; nombre: string }>> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, nombre")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()

  if (error) return err("SERVER_ERROR", error.message)
  if (!data) return err("NOT_FOUND", "La clínica no existe o está inactiva.")
  return ok(data)
}

/** Busca un doctor activo por id. */
async function findActiveDoctor(
  supabase: SupabaseClient,
  doctorId: string
): Promise<ActionResult<Doctor>> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", doctorId)
    .eq("activo", true)
    .maybeSingle()

  if (error) return err("SERVER_ERROR", error.message)
  if (!data) return err("NOT_FOUND", "El especialista no existe o no está activo.")
  return ok(data)
}

/** Minutos de la jornada del día. */
function ocupadoDeDia(
  citas: {
    hora: string
    estado: Appointment["estado"]
    lock_expira_en: string | null
  }[],
  duracionMin: number
): { start: number; end: number }[] {
  const ahora = Date.now()
  return citas
    .filter((cita) => {
      if (cita.estado === "cancelada" || cita.estado === "expirada") return false
      // Una cita 'pendiente' con lock vencido ya no bloquea el cupo.
      if (cita.estado === "pendiente" && cita.lock_expira_en) {
        return new Date(cita.lock_expira_en).getTime() > ahora
      }
      return true // confirmada | completada | pendiente sin expiración
    })
    .map((cita) => {
      const start = timeToMinutes(cita.hora)
      return { start, end: start + Math.max(duracionMin, 1) }
    })
}

function seSolapan(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}

/* ------------------------------------------------------------------ */
/* Paso 1 · Pacientes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Devuelve los pacientes (titular + familiares/menores) del tenant para
 * el usuario autenticado. Invitados sin sesión reciben lista vacía y en la
 * UI registran un paciente nuevo con la carga rápida.
 */
export async function getPatientOptions(
  clinicSlug: string
): Promise<ActionResult<PatientOptions>> {
  try {
    const supabase = await createClient()
    const tenantRes = await findActiveTenant(supabase, clinicSlug)
    if (!tenantRes.ok) return tenantRes

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    if (!userId) {
      return ok({
        tenant: tenantRes.data,
        profiles: [],
        session: { isAuthenticated: false, userId: null },
      })
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("tenant_id", tenantRes.data.id)
      .eq("user_id", userId)
      .order("es_titular", { ascending: false })
      .order("created_at", { ascending: true })

    if (error) return err("SERVER_ERROR", error.message)

    return ok({
      tenant: tenantRes.data,
      profiles: (profiles ?? []) as Profile[],
      session: { isAuthenticated: true, userId },
    })
  } catch (cause) {
    return err(unknownError(cause).code, unknownError(cause).message)
  }
}

/**
 * Carga rápida de un paciente nuevo (familiar / menor de edad / invitado).
 * Cuando existe sesión, la fila queda vinculada a `user_id` y, si es el
 * primer paciente del usuario en ese tenant, se marca como titular.
 */
export async function createPatientForBooking(
  clinicSlug: string,
  input: NewPatientInput
): Promise<ActionResult<Profile>> {
  try {
    const nombres = input.nombres?.trim()
    const apellidos = input.apellidos?.trim()

    if (!nombres || !apellidos) {
      return err("INVALID_INPUT", "Indica el nombre y apellido del paciente.")
    }
    if (input.fecha_nacimiento && !isValidDateISO(input.fecha_nacimiento)) {
      return err("INVALID_INPUT", "La fecha de nacimiento no es válida.")
    }

    const supabase = await createClient()
    const tenantRes = await findActiveTenant(supabase, clinicSlug)
    if (!tenantRes.ok) return tenantRes

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    let esTitular = !userId
    if (userId) {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantRes.data.id)
        .eq("user_id", userId)

      if (countError) return err("SERVER_ERROR", countError.message)
      esTitular = (count ?? 0) === 0
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        tenant_id: tenantRes.data.id,
        user_id: userId,
        nombres,
        apellidos,
        cedula: input.cedula?.trim() || null,
        telefono: input.telefono?.trim() || null,
        email: input.email?.trim() || null,
        fecha_nacimiento: input.fecha_nacimiento || null,
        es_menor: input.es_menor,
        es_titular: esTitular,
        parentesco: input.parentesco?.trim() || null,
      })
      .select()
      .single()

    if (error) return err("SERVER_ERROR", error.message)
    return ok(profile)
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/* ------------------------------------------------------------------ */
/* Paso 2 · Especialistas del tenant                                      */
/* ------------------------------------------------------------------ */

/**
 * Normaliza una fila cruda de `doctors` al tipo `Doctor`, tolerando que el
 * esquema real use la columna `nombre` (nombre completo) en lugar de separar
 * `nombres`/`apellidos`, y columnas opcionales ausentes (`especialidades`,
 * `precio_consulta`).
 */
function normalizeDoctorRow(row: Record<string, unknown>): Doctor {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

  let nombres = text(row.nombres)
  let apellidos = text(row.apellidos)

  // Fallback: si la clínica guarda "María Rivas" en la columna `nombre`.
  if (!nombres && !apellidos) {
    const partes = text(row.nombre).split(/\s+/).filter(Boolean)
    nombres = partes.shift() ?? ""
    apellidos = partes.join(" ")
  }

  const precio = Number(row.precio_consulta)
  const especialidades = Array.isArray(row.especialidades)
    ? (row.especialidades as unknown[]).filter(
        (item): item is string => typeof item === "string"
      )
    : []

  return {
    id: String(row.id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    nombres,
    apellidos,
    especialidad: text(row.especialidad) || "General",
    especialidades,
    foto_url: text(row.foto_url) || null,
    precio_consulta: Number.isFinite(precio) ? precio : 0,
    activo: row.activo !== false,
    created_at: text(row.created_at),
  }
}

/** Normaliza una fila de `schedules` al DTO compacto del Paso 2. */
function normalizeScheduleRow(row: Record<string, unknown>): DoctorSchedule | null {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")
  const dia = Number(row.dia_semana)
  const inicio = text(row.hora_inicio)
  const fin = text(row.hora_fin)

  if (!Number.isInteger(dia) || dia < 0 || dia > 6) return null
  if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fin)) return null

  return { dia_semana: dia, hora_inicio: inicio, hora_fin: fin }
}

/**
 * Especialistas activos de la clínica, agrupables por especialidad y con sus
 * horarios semanales (`schedules`) ya resueltos para la ficha del Paso 2.
 * Devuelve también el slug del tenant para validar la URL del flujo.
 */
export async function getDoctorsByTenant(
  clinicSlug: string
): Promise<ActionResult<DoctorWithTenant[]>> {
  try {
    const supabase = await createClient()
    const tenantRes = await findActiveTenant(supabase, clinicSlug)
    if (!tenantRes.ok) return tenantRes

    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantRes.data.id)
      .eq("activo", true)

    if (error) return err("SERVER_ERROR", error.message)

    const doctors = ((data ?? []) as unknown[]).map((row) =>
      normalizeDoctorRow(row as Record<string, unknown>)
    )
    const doctorIds = doctors.map((doctor) => doctor.id)

    // Horarios de todos los especialistas del tenant en una sola consulta.
    const schedulesByDoctor = new Map<string, DoctorSchedule[]>()
    if (doctorIds.length > 0) {
      const { data: scheduleRows, error: scheduleError } = await supabase
        .from("schedules")
        .select("*")
        .in("doctor_id", doctorIds)

      if (scheduleError) return err("SERVER_ERROR", scheduleError.message)

      for (const raw of (scheduleRows ?? []) as unknown[]) {
        const schedule = normalizeScheduleRow(raw as Record<string, unknown>)
        if (!schedule) continue

        const doctorId = String((raw as Record<string, unknown>).doctor_id ?? "")
        const lista = schedulesByDoctor.get(doctorId) ?? []
        lista.push(schedule)
        schedulesByDoctor.set(doctorId, lista)
      }
    }

    doctors.sort(
      (a, b) =>
        a.especialidad.localeCompare(b.especialidad, "es") ||
        [a.apellidos, a.nombres].filter(Boolean).join(" ").localeCompare(
          [b.apellidos, b.nombres].filter(Boolean).join(" "),
          "es"
        )
    )

    return ok(
      doctors.map((doctor) => ({
        ...doctor,
        tenant: { slug: tenantRes.data.slug },
        schedules: (schedulesByDoctor.get(doctor.id) ?? []).sort(
          (a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)
        ),
      }))
    )
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/* ------------------------------------------------------------------ */
/* Paso 3 · Disponibilidad y lock de 15 min                            */
/* ------------------------------------------------------------------ */

/** Estados de cita que ocupan un cupo y no pueden solaparse. */
const ESTADOS_BLOQUEANTES: Appointment["estado"][] = [
  "pendiente",
  "pendiente_validacion",
  "pago_en_recepcion",
  "confirmada",
  "en_espera",
  "en_consulta",
  "completada",
]

/** Duración por defecto de cada cupo (esquema lean sin `duracion_min`). */
const SLOT_DURATION_MIN = 30

/** Devuelve el ISO 'YYYY-MM-DD' del día siguiente al indicado. */
function siguienteDiaISO(dateISO: string): string {
  const date = parseDateISO(dateISO)
  date.setDate(date.getDate() + 1)
  return toISODate(date)
}

/**
 * Calcula los cupos disponibles para un doctor en una fecha concreta.
 *
 * Algoritmo (esquema lean de `schedules`/`appointments`):
 *  1. Lee los `schedules` del doctor para el día de la semana
 *     (`hora_inicio`, `hora_fin`, `dia_semana`).
 *  2. Genera cupos de 30 minutos entre hora_inicio y hora_fin.
 *  3. Resta los huecos ocupados consultando `appointments` por rango de
 *     `fecha_hora` en los estados que bloquean el cupo.
 *
 * Nota de concurrencia: el bloqueo definitivo lo hace `lockAppointmentSlot`
 * (verificación + insert). La violación 23505 se traduce a SLOT_UNAVAILABLE.
 */
export async function getAvailableSlots(
  doctorId: string,
  date: string
): Promise<ActionResult<AvailableSlotsResult>> {
  try {
    if (!isValidDateISO(date)) {
      return err("INVALID_INPUT", "La fecha indicada no es válida.")
    }

    const supabase = await createClient()
    const doctorRes = await findActiveDoctor(supabase, doctorId)
    if (!doctorRes.ok) return doctorRes

    const diaSemana = parseDateISO(date).getDay()

    const { data: schedules, error: scheduleError } = await supabase
      .from("schedules")
      .select("hora_inicio, hora_fin")
      .eq("doctor_id", doctorId)
      .eq("dia_semana", diaSemana)
      .order("hora_inicio", { ascending: true })

    if (scheduleError) return err("SERVER_ERROR", scheduleError.message)

    const slots: AvailableSlot[] = []
    for (const schedule of schedules ?? []) {
      const inicio = timeToMinutes(schedule.hora_inicio)
      const fin = timeToMinutes(schedule.hora_fin)
      for (let min = inicio; min + SLOT_DURATION_MIN <= fin; min += SLOT_DURATION_MIN) {
        const hora = minutesToTime(min)
        slots.push({ fecha: date, hora, iso: combineToISO(date, hora) })
      }
    }

    // Citas del día (bloqueadas por cupos propios u otras reservas).
    const inicioDia = combineToISO(date, "00:00")
    const finDia = combineToISO(siguienteDiaISO(date), "00:00")

    const { data: citas, error: citasError } = await supabase
      .from("appointments")
      .select("fecha_hora, estado, lock_expira_en")
      .eq("doctor_id", doctorId)
      .gte("fecha_hora", inicioDia)
      .lt("fecha_hora", finDia)
      .in("estado", ESTADOS_BLOQUEANTES)

    if (citasError) return err("SERVER_ERROR", citasError.message)

    const ocupados = ((citas ?? []) as {
      fecha_hora: string | null
      estado: Appointment["estado"]
      lock_expira_en: string | null
    }[])
      .map((cita) => {
        const local = cita.fecha_hora ?? ""
        const idx = local.indexOf("T")
        const hora = idx >= 0 ? local.slice(idx + 1, idx + 6) : ""
        return { hora, estado: cita.estado, lock_expira_en: cita.lock_expira_en }
      })
      .filter((cita) => isValidTime(cita.hora))

    const ocupadosMin = ocupadoDeDia(ocupados, SLOT_DURATION_MIN)

    const libres = slots.filter((slot) => {
      const start = timeToMinutes(slot.hora)
      const window = { start, end: start + SLOT_DURATION_MIN }
      return !ocupadosMin.some((b) => seSolapan(window, b))
    })

    return ok({ fecha: date, slots: libres })
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/** Hora referencial con la que se guarda cada turno en `fecha_hora`/`hora`. */
const HORA_REF_TURNO: Record<TurnoSeleccionado, string> = {
  manana: "08:00",
  tarde: "13:00",
}

/**
 * Bloquea un turno creando la cita en estado 'pendiente' con
 * `lock_expira_en = ahora + 15 min`.
 *
 * El paciente (`patientId`) es opcional: si viene vacío la reserva se crea
 * sin perfil (patient_id = null) y no debe romper la FK. Además se guarda el
 * turno elegido ('manana' | 'tarde') y su hora referencial (08:00 / 13:00)
 * en `fecha_hora`; si las columnas `turno`/`hora` no existen en el esquema
 * (PGRST204), se reintenta con el payload mínimo.
 */
export async function lockAppointmentSlot(input: {
  patientId?: string | null
  doctorId: string
  /** Fecha del turno 'YYYY-MM-DD'. */
  date: string
  turno: TurnoSeleccionado
}): Promise<ActionResult<Appointment>> {
  try {
    const { patientId, doctorId, date, turno } = input

    if (!isValidDateISO(date)) {
      return err("INVALID_INPUT", "La fecha seleccionada no es válida.")
    }
    const horaReferencial = HORA_REF_TURNO[turno]
    if (!horaReferencial) {
      return err("INVALID_INPUT", "Selecciona un turno válido (mañana o tarde).")
    }

    const supabase = await createClient()
    const doctorRes = await findActiveDoctor(supabase, doctorId)
    if (!doctorRes.ok) return doctorRes

    // El paciente es opcional: si viene, verificamos que exista para no
    // romper la Foreign Key; si es null/undefined, se guarda sin perfil.
    if (patientId != null) {
      const { data: paciente, error: pacienteError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", patientId)
        .maybeSingle()

      if (pacienteError) return err("SERVER_ERROR", pacienteError.message)
      if (!paciente) return err("NOT_FOUND", "El paciente seleccionado no existe.")
    }

    const fechaHora = combineToISO(date, horaReferencial)
    const expiresAtMs = Date.now() + LOCK_DURATION_MINUTES * 60_000
    const lockExpiraEn = new Date(expiresAtMs).toISOString()

    const payloadBase = {
      tenant_id: doctorRes.data.tenant_id,
      doctor_id: doctorId,
      patient_id: patientId ?? null,
      fecha_hora: fechaHora,
      estado: "pendiente" as Appointment["estado"],
      lock_expira_en: lockExpiraEn,
    }

    // 1er intento incluyendo `turno` y `hora` (columnas del nuevo modelo).
    let { data: appointment, error } = await supabase
      .from("appointments")
      .insert({ ...payloadBase, turno, hora: horaReferencial })
      .select()
      .single()

    // Esquema sin migrar (sin columnas turno/hora): payload mínimo.
    if (error?.code === "PGRST204") {
      const resultado = await supabase
        .from("appointments")
        .insert(payloadBase)
        .select()
        .single()
      appointment = resultado.data
      error = resultado.error
    }

    // 23505 = unique_violation (índice único parcial recomendado).
    if (error) {
      if (error.code === "23505") {
        return err(
          "SLOT_UNAVAILABLE",
          "Este turno ya tiene una reserva activa para esa fecha. Prueba con el otro turno."
        )
      }
      return err("SERVER_ERROR", error.message)
    }
    if (!appointment) {
      return err("SERVER_ERROR", "No se pudo crear la reserva del turno.")
    }

    return ok(appointment)
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/**
 * Libera un lock: si la cita sigue 'pendiente', la pasa a 'cancelada'
 * (lock vigente) o 'expirada' (ya vencido). Se usa cuando el usuario
 * retrocede en el wizard o cuando el temporizador llega a 0.
 */
export async function releaseLockedSlot(
  appointmentId: string
): Promise<ActionResult<{ id: string; estado: Appointment["estado"] }>> {
  try {
    const supabase = await createClient()

    const { data: cita, error } = await supabase
      .from("appointments")
      .select("id, estado, lock_expira_en")
      .eq("id", appointmentId)
      .maybeSingle()

    if (error) return err("SERVER_ERROR", error.message)
    if (!cita) return err("NOT_FOUND", "La cita bloqueada ya no existe.")

    if (cita.estado !== "pendiente") {
      return ok({ id: cita.id, estado: cita.estado })
    }

    const expirada =
      cita.lock_expira_en !== null &&
      new Date(cita.lock_expira_en).getTime() <= Date.now()

    const estado: Appointment["estado"] = expirada ? "expirada" : "cancelada"

    const { data: actualizada, error: updateError } = await supabase
      .from("appointments")
      .update({ estado })
      .eq("id", appointmentId)
      .eq("estado", "pendiente")
      .select("id, estado")
      .single()

    if (updateError) return err("SERVER_ERROR", updateError.message)
    return ok(actualizada)
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/* ------------------------------------------------------------------ */
/* Paso 4 · Pago (método de pago)                                      */
/* ------------------------------------------------------------------ */

/**
 * Registra la forma de pago elegida en el Paso 4:
 *
 *  - `en_linea`:  el paciente transfirió por Pago Móvil, adjuntó el
 *                 comprobante e indicó referencia y teléfono emisor.
 *                 Estado → 'pendiente_validacion'.
 *  - `recepcion`: pagará en caja el día de la cita (efectivo, punto de
 *                 venta o Pago Móvil en sitio). Estado → 'pago_en_recepcion'.
 *
 * Las columnas `telefono_emisor`/`banco_origen` se escriben si existen;
 * si la tabla aún no está migrada (PGRST204) se reintenta con el payload
 * mínimo (estado, referencia_pago y comprobante_url).
 */
export async function registerAppointmentPayment(
  appointmentId: string,
  input: PaymentMethodInput
): Promise<ActionResult<Appointment>> {
  try {
    const supabase = await createClient()

    const { data: cita, error } = await supabase
      .from("appointments")
      .select("id, estado, lock_expira_en")
      .eq("id", appointmentId)
      .maybeSingle()

    if (error) return err("SERVER_ERROR", error.message)
    if (!cita) return err("NOT_FOUND", "La reserva ya no existe.")

    if (cita.estado === "cancelada" || cita.estado === "expirada") {
      return err(
        "LOCK_EXPIRED",
        "El bloqueo de 15 minutos venció. Vuelve a elegir tu hora."
      )
    }
    if (cita.estado !== "pendiente") {
      return err(
        "CONFLICT",
        "Esta reserva ya fue registrada. Espera la confirmación de la clínica."
      )
    }

    const lockVencido =
      cita.lock_expira_en !== null &&
      new Date(cita.lock_expira_en).getTime() <= Date.now()
    if (lockVencido) {
      return err(
        "LOCK_EXPIRED",
        "El bloqueo de 15 minutos venció. Vuelve a elegir tu hora."
      )
    }

    const actualizar = async (payload: AppointmentUpdate) => {
      const primerIntento = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointmentId)
        .eq("estado", "pendiente")
        .select()
        .single()

      // Esquema sin migrar: las columnas extra no existen → payload mínimo.
      if (primerIntento.error?.code === "PGRST204") {
        const basico = {
          estado: payload.estado,
          referencia_pago: payload.referencia_pago,
          comprobante_url: payload.comprobante_url,
        }
        return supabase
          .from("appointments")
          .update(basico)
          .eq("id", appointmentId)
          .eq("estado", "pendiente")
          .select()
          .single()
      }
      return primerIntento
    }

    if (input.metodo === "recepcion") {
      const { data: actualizada, error: updateError } = await actualizar({
        estado: "pago_en_recepcion",
      })
      if (updateError) return err("SERVER_ERROR", updateError.message)
      return ok(actualizada)
    }

    const referencia = input.datos.referenciaPago?.trim() ?? ""
    if (!/^\d{4,8}$/.test(referencia)) {
      return err(
        "INVALID_INPUT",
        "Escribe el número de referencia de la transferencia (entre 4 y 8 dígitos)."
      )
    }

    const telefono = input.datos.telefonoEmisor?.trim() ?? ""
    if (telefono.replace(/\D/g, "").length < 7) {
      return err(
        "INVALID_INPUT",
        "Indica el teléfono desde el cual realizaste el Pago Móvil."
      )
    }

    const comprobanteUrl = input.datos.comprobanteUrl?.trim() || null
    if (comprobanteUrl && !comprobanteUrl.startsWith("http")) {
      return err("INVALID_INPUT", "El comprobante adjunto no es válido.")
    }

    const { data: actualizada, error: updateError } = await actualizar({
      estado: "pendiente_validacion",
      referencia_pago: referencia,
      comprobante_url: comprobanteUrl,
      telefono_emisor: telefono,
      banco_origen: input.datos.bancoOrigen?.trim() || null,
    })
    if (updateError) return err("SERVER_ERROR", updateError.message)
    return ok(actualizada)
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}




