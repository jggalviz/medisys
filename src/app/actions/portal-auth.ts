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
  clearPortalCookie,
  getPortalSession as leerPortalSession,
  setPortalCookie,
  type PortalSession,
} from "@/lib/portal-session"

export type PortalLoginResult =
  | { ok: true; sesion: PortalSession }
  | { ok: false; message: string }

export type { PortalSession } from "@/lib/portal-session"

function limpiarCedula(valor: string): string {
  // "V-12.345.678" → "12345678"; "V12345678" → "12345678"
  return valor.toUpperCase().replace(/\D/g, "")
}

function limpiarTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, "")
  // Normaliza prefijo 58/+58: comparamos los últimos 10 dígitos.
  return digitos.length > 10 ? digitos.slice(-10) : digitos
}

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

/** Cierra la sesión del portal y redirige al login del rol. */
export async function logoutPortal(
  rol: "especialista" | "paciente",
  clinicSlug: string
): Promise<void> {
  await clearPortalCookie()
  redirect(`/${clinicSlug}/${rol}/login`)
}
