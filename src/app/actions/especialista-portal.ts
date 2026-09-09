"use server"

/**
 * MEDISYS · Portal del Especialista.
 *
 * Todas las consultas usan el cliente service_role del servidor, pero se
 * filtran SIEMPRE por `doctor_id` y `tenant_id` extraídos de la cookie de
 * sesión (nunca se confía en el pacienteId que venga en la URL).
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getPortalSession } from "./portal-auth"
import type { MedicalRecord } from "@/types/database"

export type PortalResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type PacienteDelEspecialista = {
  id: string
  nombre: string
  cedula: string | null
  telefono: string | null
  ultimaCita: string | null
  totalCitas: number
}

export type CitaExpediente = {
  id: string
  fecha_hora: string
  estado: string
  creada: string
  registro?: MedicalRecord | null
}

export type HistorialPaciente = {
  paciente: {
    id: string
    nombre: string
    cedula: string | null
    telefono: string | null
  }
  citas: CitaExpediente[]
}

export type EvolucionConsultaPayload = {
  motivo: string
  diagnostico: string
  tratamiento: string
  notas: string
}

async function contextoEspecialista() {
  const sesion = await getPortalSession()
  if (!sesion || sesion.rol !== "especialista") {
    return { ok: false as const, message: "No autorizado: inicia sesión como especialista." }
  }
  return { ok: true as const, sesion, supabase: createAdminClient() }
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function nulo(v: unknown): string | null {
  return v == null ? null : texto(v)
}

/** Lista única de pacientes que tienen (o tuvieron) citas con el especialista. */
export async function getPacientesDelEspecialista(): Promise<
  PortalResult<PacienteDelEspecialista[]>
> {
  try {
    const ctx = await contextoEspecialista()
    if (!ctx.ok) return ctx

    const { supabase, sesion } = ctx
    const { data: citas, error } = await supabase
      .from("appointments")
      .select("patient_id, fecha_hora, created_at")
      .eq("tenant_id", sesion.tenant_id)
      .eq("doctor_id", sesion.id)
      .order("fecha_hora", { ascending: false })

    if (error) return { ok: false, message: error.message }

    const filas = (citas ?? []) as unknown as Record<string, unknown>[]
    const porPaciente = new Map<
      string,
      { ultima: string; total: number }
    >()
    for (const fila of filas) {
      const id = texto(fila.patient_id)
      if (!id) continue
      const actual = porPaciente.get(id) ?? { ultima: "", total: 0 }
      actual.total += 1
      if (!actual.ultima) actual.ultima = texto(fila.fecha_hora)
      porPaciente.set(id, actual)
    }

    const ids = Array.from(porPaciente.keys())
    if (ids.length === 0) return { ok: true, data: [] }

    const { data: perfiles, error: errPerfiles } = await supabase
      .from("profiles")
      .select("id, nombres, apellidos, cedula, telefono")
      .in("id", ids)
      .eq("tenant_id", sesion.tenant_id)

    if (errPerfiles) return { ok: false, message: errPerfiles.message }

    const lista = ((perfiles ?? []) as unknown as Record<string, unknown>[]).map(
      (fila): PacienteDelEspecialista => {
        const meta = porPaciente.get(texto(fila.id))
        return {
          id: texto(fila.id),
          nombre: [texto(fila.nombres), texto(fila.apellidos)]
            .filter(Boolean)
            .join(" ")
            .trim(),
          cedula: nulo(fila.cedula),
          telefono: nulo(fila.telefono),
          ultimaCita: meta?.ultima ?? null,
          totalCitas: meta?.total ?? 0,
        }
      }
    )
    return {
      ok: true,
      data: lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al listar pacientes.",
    }
  }
}

/** Expediente completo de un paciente con este especialista. */
export async function getHistorialPaciente(
  pacienteId: string
): Promise<PortalResult<HistorialPaciente>> {
  try {
    const ctx = await contextoEspecialista()
    if (!ctx.ok) return ctx
    const { supabase, sesion } = ctx
    if (!pacienteId.trim()) return { ok: false, message: "Falta el paciente." }

    const { data: paciente, error: errPaciente } = await supabase
      .from("profiles")
      .select("id, nombres, apellidos, cedula, telefono")
      .eq("id", pacienteId)
      .eq("tenant_id", sesion.tenant_id)
      .maybeSingle()
    if (errPaciente) return { ok: false, message: errPaciente.message }
    if (!paciente) return { ok: false, message: "Paciente no encontrado." }

    const { data: citas, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", sesion.tenant_id)
      .eq("doctor_id", sesion.id)
      .eq("patient_id", pacienteId)
      .order("fecha_hora", { ascending: false })

    if (error) return { ok: false, message: error.message }
    const citasFila = (citas ?? []) as unknown as Record<string, unknown>[]
    const citaIds = citasFila.map((fila) => texto(fila.id)).filter(Boolean)

    const registros = new Map<string, MedicalRecord>()
    if (citaIds.length > 0) {
      const { data: records, error: errRecords } = await supabase
        .from("medical_records")
        .select("*")
        .eq("tenant_id", sesion.tenant_id)
        .eq("doctor_id", sesion.id)
        .in("appointment_id", citaIds)
      if (errRecords) return { ok: false, message: errRecords.message }
      for (const rec of (records ?? []) as unknown as MedicalRecord[]) {
        registros.set(rec.appointment_id, rec)
      }
    }

    const expediente: HistorialPaciente = {
      paciente: {
        id: texto(paciente.id),
        nombre:
          [texto(paciente.nombres), texto(paciente.apellidos)]
            .filter(Boolean)
            .join(" ")
            .trim() || "Paciente",
        cedula: nulo(paciente.cedula),
        telefono: nulo(paciente.telefono),
      },
      citas: citasFila.map(
        (fila): CitaExpediente => ({
          id: texto(fila.id),
          fecha_hora: texto(fila.fecha_hora),
          estado: texto(fila.estado) || "desconocido",
          creada: texto(fila.created_at),
          registro: registros.get(texto(fila.id)) ?? null,
        })
      ),
    }
    return { ok: true, data: expediente }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al leer expediente.",
    }
  }
}

/** Guarda la evolución clínica de una consulta y marca la cita como Atendida. */
export async function guardarEvolucionConsulta(
  citaId: string,
  payload: EvolucionConsultaPayload
): Promise<PortalResult<MedicalRecord>> {
  try {
    const ctx = await contextoEspecialista()
    if (!ctx.ok) return ctx
    const { supabase, sesion } = ctx
    if (!citaId.trim()) return { ok: false, message: "Falta la cita a registrar." }

    // La cita debe pertenecer al especialista autenticado y al tenant.
    const { data: cita, error: errCita } = await supabase
      .from("appointments")
      .select("id, patient_id, doctor_id")
      .eq("id", citaId)
      .eq("tenant_id", sesion.tenant_id)
      .eq("doctor_id", sesion.id)
      .maybeSingle()
    if (errCita) return { ok: false, message: errCita.message }
    if (!cita) {
      return { ok: false, message: "La cita no existe para este especialista." }
    }

    const registroPayload = {
      tenant_id: sesion.tenant_id,
      appointment_id: citaId,
      patient_id: String(cita.patient_id ?? ""),
      doctor_id: sesion.id,
      motivo: payload.motivo.trim() || null,
      diagnostico: payload.diagnostico.trim() || null,
      tratamiento: payload.tratamiento.trim() || null,
      notas: payload.notas.trim() || null,
    }

    const { data: registro, error: errInsert } = await supabase
      .from("medical_records")
      .upsert(registroPayload, { onConflict: "appointment_id" })
      .select("*")
      .maybeSingle()
    if (errInsert) return { ok: false, message: errInsert.message }
    if (!registro) return { ok: false, message: "No se pudo guardar la evolución." }

    const { error: errEstado } = await supabase
      .from("appointments")
      .update({ estado: "atendido" })
      .eq("id", citaId)
      .eq("tenant_id", sesion.tenant_id)
      .eq("doctor_id", sesion.id)
    if (errEstado) return { ok: false, message: errEstado.message }

    return { ok: true, data: registro as unknown as MedicalRecord }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al guardar evolución.",
    }
  }
}
