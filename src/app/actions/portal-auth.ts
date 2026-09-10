"use server"

/**
 * MEDISYS · Autenticación ligera de portales.
 *
 * Especialista y Paciente acceden con su Cédula + Teléfono dentro del tenant
 * actual (sin contraseña). La sesión viaja en una cookie `portal_session`
 * httpOnly y firmada (HMAC-SHA256).
 *
 * Nota de esquema: los pacientes se guardan en la tabla `profiles` (no existe
 * tabla `patients` en este proyecto); la consulta se filtra por `tenant_id`.
 */
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  normalizarCedula,
  normalizarTelefono,
} from "@/lib/portal-identidad"
import {
  clearPortalCookie,
  getPortalSession as leerPortalSession,
  setPortalCookie,
  type PortalSession,
} from "@/lib/portal-session"

export type PortalLoginResult =
  | { ok: true; sesion: PortalSession }
  | { ok: false; message: string }

export type { PortalSession } from "@/lib/portal-session"

/** Alias internos (los normalizadores viven en `@/lib/portal-identidad`). */
const limpiarCedula = normalizarCedula
const limpiarTelefono = normalizarTelefono

/** Compara cédula/teléfono de una fila cruda contra la entrada limpia. */
function coincide(
  fila: Record<string, unknown>,
  cedula: string,
  telefono: string
): boolean {
  const cedulaFila = limpiarCedula(typeof fila.cedula === "string" ? fila.cedula : "")
  const telFila = limpiarTelefono(typeof fila.telefono === "string" ? fila.telefono : "")
  return cedulaFila === cedula && telFila === telefono
}

function nombreDe(fila: Record<string, unknown>): string {
  const separado = [fila.nombres, fila.apellidos]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ")
    .trim()
  return separado || (typeof fila.nombre === "string" ? fila.nombre : "Usuario")
}

/**
 * Inicia sesión en un portal validando Cédula + Teléfono.
 *
 * @param rol    'paciente' → tabla `profiles` | 'especialista' → tabla `doctors`
 * @param tenantId UUID del tenant actual (contexto multi-tenant)
 */
export async function loginPortal(
  cedula: string,
  telefono: string,
  rol: "especialista" | "paciente",
  tenantId: string
): Promise<PortalLoginResult> {
  const cedulaLimpia = limpiarCedula(cedula)
  const telefonoLimpio = limpiarTelefono(telefono)
  if (!cedulaLimpia || telefonoLimpio.length < 7) {
    return { ok: false, message: "Indica una cédula y teléfono válidos." }
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = rol === "paciente"
      ? await supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", tenantId)
      : await supabase
          .from("doctors")
          .select("*")
          .eq("tenant_id", tenantId)

    if (error) {
      console.error("[loginPortal] Error consultando credenciales:", error)
      return { ok: false, message: "No se pudo verificar el acceso." }
    }

    const coincidencia = ((data ?? []) as unknown as Record<string, unknown>[])
      .filter((fila) => coincide(fila, cedulaLimpia, telefonoLimpio))
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
      .at(0)

    if (!coincidencia) {
      return {
        ok: false,
        message:
          "No encontramos una cuenta con esos datos en esta clínica. Verifica tu cédula y teléfono.",
      }
    }

    const sesion: PortalSession = {
      id: String(coincidencia.id),
      rol,
      tenant_id: tenantId,
      nombre: nombreDe(coincidencia),
      cedula: cedulaLimpia,
    }
    await setPortalCookie(sesion)
    return { ok: true, sesion }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error inesperado al iniciar sesión.",
    }
  }
}

/** Helper de servidor: devuelve la sesión activa verificada o null. */
export async function getPortalSession(): Promise<PortalSession | null> {
  return leerPortalSession()
}

export type CredencialesDemoResult =
  | { ok: true; data: { cedula: string; telefono: string; nombre: string } }
  | { ok: false; message: string }

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : ""
}

/**
 * Credenciales DEMO dinámicas del tenant: la cédula y el teléfono del primer
 * especialista activo (rol 'especialista') o del primer perfil registrado
 * (rol 'paciente'). Sirve para autocompletar el acceso del portal sin datos
 * estáticos — funciona igual para Plan PRO o Plan Clínica.
 */
export async function getCredencialesDemoPortal(
  tenantId: string,
  rol: "especialista" | "paciente"
): Promise<CredencialesDemoResult> {
  if (!tenantId?.trim()) {
    return { ok: false, message: "Clínica no válida." }
  }

  try {
    const supabase = createAdminClient()
    const tabla = rol === "paciente" ? "profiles" : "doctors"
    const { data, error } = await supabase
      .from(tabla)
      .select("*")
      .eq("tenant_id", tenantId)
      .limit(50)

    if (error) {
      console.error("[getCredencialesDemoPortal] Error consultando registros:", error)
      return { ok: false, message: "No se pudieron obtener los datos DEMO." }
    }

    const filas = (data ?? []) as unknown as Record<string, unknown>[]
    const candidatas = filas
      .filter((fila) => {
        if (rol === "paciente") return true
        return fila.activo !== false && fila.is_active !== false
      })
      .filter((fila) => {
        const cedula = limpiarCedula(texto(fila.cedula))
        const telefono = limpiarTelefono(texto(fila.telefono))
        return cedula.length >= 6 && telefono.length >= 7
      })
      .sort((a, b) =>
        texto(a.created_at).localeCompare(texto(b.created_at))
      )

    const elegida = candidatas.at(0)
    if (!elegida) {
      return {
        ok: false,
        message: "Aún no hay registros con cédula y teléfono para la DEMO.",
      }
    }

    return {
      ok: true,
      data: {
        cedula: limpiarCedula(texto(elegida.cedula)),
        telefono: limpiarTelefono(texto(elegida.telefono)),
        nombre: nombreDe(elegida),
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al obtener los datos DEMO.",
    }
  }
}

/** Cierra la sesión del portal y redirige al login del rol. */
export async function logoutPortal(
  rol: "especialista" | "paciente",
  clinicSlug: string
): Promise<void> {
  await clearPortalCookie()
  redirect(`/${clinicSlug}/${rol}/login`)
}
