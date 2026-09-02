"use server"

/**
 * MEDISYS · Server Actions del flujo de reserva (Booking Wizard)
 * -----------------------------------------------------------------
 * Toda la lógica de negocio sensible corre en el servidor con el
 * cliente Supabase `@/lib/supabase/server` (sesión vía cookies).
 *
 *  - `getDoctorsByTenant`      especialidades/médicos públicos del tenant
 *  - `getAvailableSlots`       cupos del día a partir de `schedules`
 *  - `lockAppointmentSlot`     crea cita 'pendiente' con lock de 15 min
 *  - `confirmBookingPayment`   adjunta referencia + comprobante de pago
 *  - `releaseLockedSlot`       libera el lock al vencer / al retroceder
 *
 * Errores: nunca se lanzan excepciones al cliente; se devuelve
 * `ActionResult<T>` con códigos accionables por la UI.
 */
import { LOCK_DURATION_MINUTES } from "@/types/database"
import type { Appointment, Doctor, Profile } from "@/types/database"
import type {
  ActionResult,
  AvailableSlot,
  AvailableSlotsResult,
  DoctorWithTenant,
  NewPatientInput,
  PatientOptions,
} from "@/types/booking"
import { createClient } from "@/lib/supabase/server"
import {
  combineToISO,
  isValidDateISO,
  isValidTime,
  minutesToTime,
  parseDateISO,
  timeToMinutes,
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
  if (!data) return err("NOT_FOUND", "El médico no existe o no está activo.")
  return ok(data)
}

/** Minutos de la jornada del día. */
function ocupadoDeDia(
  citas: Pick<Appointment, "hora" | "estado" | "lock_expira_en">[],
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
/* Paso 2 · Médicos del tenant                                         */
/* ------------------------------------------------------------------ */

/**
 * Médicos activos de la clínica. Se devuelve también el slug del tenant
 * para que el cliente pueda validar que no cambió de URL durante el flujo.
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
      .order("especialidad", { ascending: true })
      .order("apellidos", { ascending: true })

    if (error) return err("SERVER_ERROR", error.message)

    return ok(
      ((data ?? []) as Doctor[]).map((doctor) => ({
        ...doctor,
        tenant: { slug: tenantRes.data.slug },
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

/**
 * Calcula los cupos disponibles para un doctor en una fecha concreta.
 *
 * Algoritmo:
 *  1. Lee los `schedules` activos del doctor para el día de la semana.
 *  2. Genera los cupos entre hora_inicio y hora_fin según `duracion_min`.
 *  3. Resta los huecos ya ocupados por citas activas (pendiente con lock
 *     vigente, confirmada o completada) — las canceladas/expiradas liberan.
 *
 * Nota de concurrencia: el bloqueo definitivo lo hace `lockAppointmentSlot`
 * (verificación + insert). Para producción se recomienda un índice único
 * parcial en `appointments(doctor_id, fecha_hora)` donde estado no sea
 * 'cancelada' ni 'expirada'; la violación 23505 se traduce a SLOT_UNAVAILABLE.
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
      .select("hora_inicio, hora_fin, duracion_min")
      .eq("doctor_id", doctorId)
      .eq("dia_semana", diaSemana)
      .eq("activo", true)
      .order("hora_inicio", { ascending: true })

    if (scheduleError) return err("SERVER_ERROR", scheduleError.message)

    const slots: AvailableSlot[] = []
    for (const schedule of schedules ?? []) {
      const inicio = timeToMinutes(schedule.hora_inicio)
      const fin = timeToMinutes(schedule.hora_fin)
      const paso = Math.max(schedule.duracion_min, 10)
      for (let min = inicio; min + paso <= fin; min += paso) {
        const hora = minutesToTime(min)
        slots.push({ fecha: date, hora, iso: combineToISO(date, hora) })
      }
    }

    const { data: citas, error: citasError } = await supabase
      .from("appointments")
      .select("hora, estado, lock_expira_en")
      .eq("doctor_id", doctorId)
      .eq("fecha", date)
      .in("estado", ["pendiente", "confirmada", "completada", "cancelada", "expirada"])

    if (citasError) return err("SERVER_ERROR", citasError.message)

    const duracion = Math.max(...(schedules ?? []).map((s) => s.duracion_min), 30)
    const ocupados = ocupadoDeDia((citas ?? []) as never[], duracion)

    const libres = slots.filter((slot) => {
      const start = timeToMinutes(slot.hora)
      const window = { start, end: start + duracion }
      return !ocupados.some((b) => seSolapan(window, b))
    })

    return ok({ fecha: date, slots: libres })
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}

/**
 * Bloquea un cupo creando la cita en estado 'pendiente' con
 * `lock_expira_en = ahora + 15 min`. Mientras el lock esté vigente,
 * el cupo desaparece de `getAvailableSlots` para los demás pacientes.
 *
 * @param patientId id del paciente que se atenderá (tabla `profiles`)
 * @param doctorId  médico seleccionado
 * @param dateTime  fecha+hora local sin zona: 'YYYY-MM-DDTHH:mm'
 */
export async function lockAppointmentSlot(
  patientId: string,
  doctorId: string,
  dateTime: string
): Promise<ActionResult<Appointment>> {
  try {
    const idx = dateTime.indexOf("T")
    const date = idx > 0 ? dateTime.slice(0, idx) : ""
    const time = idx > 0 ? dateTime.slice(idx + 1) : ""

    if (!isValidDateISO(date) || !isValidTime(time)) {
      return err("INVALID_INPUT", "El cupo seleccionado no es válido.")
    }

    const supabase = await createClient()
    const doctorRes = await findActiveDoctor(supabase, doctorId)
    if (!doctorRes.ok) return doctorRes

    const { data: paciente, error: pacienteError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", patientId)
      .maybeSingle()

    if (pacienteError) return err("SERVER_ERROR", pacienteError.message)
    if (!paciente) return err("NOT_FOUND", "El paciente seleccionado no existe.")

    // 1) Recalcular disponibilidad: si el cupo ya no aparece es porque
    //    otro usuario lo bloqueó/reservó entre la carga y la confirmación.
    const disponiblesRes = await getAvailableSlots(doctorId, date)
    if (!disponiblesRes.ok) return disponiblesRes
    const disponible = disponiblesRes.data.slots.some((s) => s.hora === time)
    if (!disponible) {
      return err(
        "SLOT_UNAVAILABLE",
        "Lo sentimos, esa hora acaba de ser bloqueada por otra persona. Elige otro cupo."
      )
    }

    const fechaHora = combineToISO(date, time)
    const expiresAtMs = Date.now() + LOCK_DURATION_MINUTES * 60_000

    // 2) Crear la cita 'pendiente' con su lock.
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: doctorRes.data.tenant_id,
        doctor_id: doctorId,
        patient_id: patientId,
        fecha: date,
        hora: time,
        fecha_hora: fechaHora,
        estado: "pendiente",
        lock_expira_en: new Date(expiresAtMs).toISOString(),
        pago_estado: "pendiente",
        monto: doctorRes.data.precio_consulta,
      })
      .select()
      .single()

    // 23505 = unique_violation (índice único parcial recomendado).
    if (error) {
      if (error.code === "23505") {
        return err("SLOT_UNAVAILABLE", "Esa hora fue reservada por otra persona.")
      }
      return err("SERVER_ERROR", error.message)
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
/* Paso 4 · Pago (referencia + comprobante)                            */
/* ------------------------------------------------------------------ */

/**
 * Registra la referencia del Pago Móvil/Zelle y la URL pública del
 * comprobante subido. La cita pasa a `pago_estado = 'en_revision'` y
 * queda esperando la validación del tenant.
 */
export async function confirmBookingPayment(
  appointmentId: string,
  referenciaPago: string,
  comprobanteUrl?: string | null
): Promise<ActionResult<Appointment>> {
  try {
    const referencia = referenciaPago?.trim()
    if (!referencia || referencia.length < 3) {
      return err(
        "INVALID_INPUT",
        "Escribe el número de referencia de 6 dígitos del Pago Móvil o del Zelle."
      )
    }
    if (comprobanteUrl && !comprobanteUrl.startsWith("http")) {
      return err("INVALID_INPUT", "El comprobante adjunto no es válido.")
    }

    const supabase = await createClient()

    const { data: cita, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle()

    if (error) return err("SERVER_ERROR", error.message)
    if (!cita) return err("NOT_FOUND", "La reserva ya no existe.")

    if (cita.estado === "cancelada" || cita.estado === "expirada") {
      return err("LOCK_EXPIRED", "El bloqueo de 15 minutos venció. Vuelve a elegir tu hora.")
    }

    const lockVencido =
      cita.estado === "pendiente" &&
      cita.lock_expira_en !== null &&
      new Date(cita.lock_expira_en).getTime() <= Date.now()

    if (lockVencido) {
      return err("LOCK_EXPIRED", "El bloqueo de 15 minutos venció. Vuelve a elegir tu hora.")
    }

    if (cita.pago_estado === "en_revision" || cita.pago_estado === "pagada") {
      return err(
        "CONFLICT",
        "Esta reserva ya tiene un comprobante registrado. Espera la confirmación de la clínica."
      )
    }

    const { data: actualizada, error: updateError } = await supabase
      .from("appointments")
      .update({
        pago_referencia: referencia,
        comprobante_url: comprobanteUrl?.trim() || null,
        pago_estado: "en_revision",
      })
      .eq("id", appointmentId)
      .eq("estado", "pendiente")
      .select()
      .single()

    if (updateError) return err("SERVER_ERROR", updateError.message)

    return ok(actualizada)
  } catch (cause) {
    const e = unknownError(cause)
    return err(e.code, e.message)
  }
}




