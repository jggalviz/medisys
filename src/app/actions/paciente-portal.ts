"use server"

/**
 * MEDISYS · Portal del Paciente.
 *
 * Todo se consulta con el cliente service_role del servidor, filtrando
 * SIEMPRE por `patient_id` y `tenant_id` de la cookie de sesión.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getLatestBcvRate } from "@/lib/bcv"
import { getPortalSession } from "./portal-auth"

export type PortalResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type CitaPaciente = {
  id: string
  fecha_hora: string
  estado: string
  especialista: string
  creada: string
}

export type HistorialMedicoItem = {
  id: string
  fecha_cita: string
  especialista: string
  motivo: string | null
  diagnostico: string | null
  tratamiento: string | null
  notas: string | null
}

export type PagoPaciente = {
  id: string
  fecha_cita: string
  especialista: string
  montoUsd: number
  montoVes: number
  tasaBCV: number
  referencia: string | null
  estadoPago: "por_validar" | "aprobado" | "rechazado" | null
}

export type DatosPaciente = {
  paciente: { id: string; nombre: string; cedula: string | null; telefono: string | null }
  citas: CitaPaciente[]
  historial: HistorialMedicoItem[]
  pagos: PagoPaciente[]
}

async function contextoPaciente() {
  const sesion = await getPortalSession()
  if (!sesion || sesion.rol !== "paciente") {
    return {
      ok: false as const,
      message: "No autorizado: inicia sesión como paciente.",
    }
  }
  return { ok: true as const, sesion, supabase: createAdminClient() }
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function nulo(v: unknown): string | null {
  return v == null ? null : texto(v)
}

function nombreDoctor(fila: Record<string, unknown>): string {
  return (
    [texto(fila.nombres), texto(fila.apellidos)]
      .filter(Boolean)
      .join(" ")
      .trim() || "Especialista"
  )
}

/** Expediente completo del paciente autenticado (citas, historial y pagos). */
export async function getDatosPaciente(): Promise<PortalResult<DatosPaciente>> {
  try {
    const ctx = await contextoPaciente()
    if (!ctx.ok) return ctx
    const { supabase, sesion } = ctx

    const { data: perfil, error: errPerfil } = await supabase
      .from("profiles")
      .select("id, nombres, apellidos, cedula, telefono")
      .eq("id", sesion.id)
      .eq("tenant_id", sesion.tenant_id)
      .maybeSingle()
    if (errPerfil) return { ok: false, message: errPerfil.message }
    if (!perfil) return { ok: false, message: "Perfil no encontrado." }

    /* ---------------------------- Citas ---------------------------- */
    const { data: citas, error: errCitas } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", sesion.tenant_id)
      .eq("patient_id", sesion.id)
      .order("fecha_hora", { ascending: true })
    if (errCitas) return { ok: false, message: errCitas.message }

    const filasCitas = (citas ?? []) as unknown as Record<string, unknown>[]
    const doctorIds = Array.from(
      new Set(filasCitas.map((f) => texto(f.doctor_id)).filter(Boolean))
    )

    const doctores = new Map<string, string>()
    if (doctorIds.length > 0) {
      const { data } = await supabase
        .from("doctors")
        .select("id, nombres, apellidos")
        .in("id", doctorIds)
      for (const fila of (data ?? []) as unknown as Record<string, unknown>[]) {
        doctores.set(texto(fila.id), nombreDoctor(fila))
      }
    }

    const citaLista: CitaPaciente[] = filasCitas.map((fila) => ({
      id: texto(fila.id),
      fecha_hora: texto(fila.fecha_hora),
      estado: texto(fila.estado) || "desconocido",
      especialista: doctores.get(texto(fila.doctor_id)) ?? "Especialista",
      creada: texto(fila.created_at),
    }))

    /* --------------------- Historial médico ------------------------ */
    const { data: registros, error: errReg } = await supabase
      .from("medical_records")
      .select("*")
      .eq("tenant_id", sesion.tenant_id)
      .eq("patient_id", sesion.id)
      .order("created_at", { ascending: false })
    if (errReg) return { ok: false, message: errReg.message }
    const filasRegistros = (registros ?? []) as unknown as Record<string, unknown>[]

    const fechaCita = new Map<string, string>()
    if (filasRegistros.length > 0) {
      const citaIds = filasRegistros
        .map((r) => texto(r.appointment_id))
        .filter(Boolean)
      const { data: citasDeRegistros } = await supabase
        .from("appointments")
        .select("id, fecha_hora, doctor_id")
        .in("id", citaIds)
      for (const fila of (citasDeRegistros ?? []) as unknown as Record<string, unknown>[]) {
        fechaCita.set(texto(fila.id), texto(fila.fecha_hora))
      }
    }

    const historial: HistorialMedicoItem[] = filasRegistros.map((fila) => ({
      id: texto(fila.id),
      fecha_cita:
        fechaCita.get(texto(fila.appointment_id)) ?? texto(fila.created_at),
      especialista: doctores.get(texto(fila.doctor_id)) ?? "Especialista",
      motivo: nulo(fila.motivo),
      diagnostico: nulo(fila.diagnostico),
      tratamiento: nulo(fila.tratamiento),
      notas: nulo(fila.notas),
    }))

    /* --------------------------- Pagos ----------------------------- */
    const tasaBCV = await getLatestBcvRate(supabase)
    const precios = new Map<string, number>()
    if (doctorIds.length > 0) {
      const { data: docs } = await supabase
        .from("doctors")
        .select("id, precio_consulta")
        .in("id", doctorIds)
      for (const fila of (docs ?? []) as unknown as Record<string, unknown>[]) {
        const precio = Number(fila.precio_consulta)
        precios.set(texto(fila.id), Number.isFinite(precio) ? precio : 0)
      }
    }

    const pagos: PagoPaciente[] = filasCitas.map((fila) => {
      const estado = texto(fila.estado)
      const estadoPago: PagoPaciente["estadoPago"] =
        estado === "pendiente_validacion" || estado === "pago_en_recepcion"
          ? "por_validar"
          : estado === "confirmada" || estado === "atendido"
            ? "aprobado"
            : estado === "pago_rechazado"
              ? "rechazado"
              : null
      const usd = precios.get(texto(fila.doctor_id)) ?? 0
      return {
        id: texto(fila.id),
        fecha_cita: texto(fila.fecha_hora),
        especialista: doctores.get(texto(fila.doctor_id)) ?? "Especialista",
        montoUsd: usd,
        montoVes: usd * tasaBCV,
        tasaBCV,
        referencia: nulo(fila.referencia_pago),
        estadoPago,
      }
    })

    return {
      ok: true,
      data: {
        paciente: {
          id: texto(perfil.id),
          nombre:
            [texto(perfil.nombres), texto(perfil.apellidos)]
              .filter(Boolean)
              .join(" ")
              .trim() || "Paciente",
          cedula: nulo(perfil.cedula),
          telefono: nulo(perfil.telefono),
        },
        citas: citaLista,
        historial,
        pagos,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al leer tu expediente.",
    }
  }
}
