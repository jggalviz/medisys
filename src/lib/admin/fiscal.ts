/**
 * MEDISYS · Entidad fiscal del tenant (módulo de administración)
 * -----------------------------------------------------------------
 * Lee y guarda los datos corporativos que exige la facturación venezolana
 * (razón social, RIF, domicilio fiscal, contacto y datos de la imprenta
 * autorizada de formas libres).
 *
 * Tolerante a esquemas previos: si la migración 0016 no está aplicada, la
 * lectura degrada a las columnas históricas (`nombre`, `rif`, `direccion`) y
 * la escritura devuelve `MIGRACION_PENDIENTE` en lugar de perder datos.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult, EntidadFiscal } from "@/types/admin"
import type { Database, TenantUpdate } from "@/types/database"
import { entidadFiscalSchema } from "@/lib/validations/admin"

type Client = SupabaseClient<Database>

/** Columnas fiscales creadas por la migración 0016. */
const COLUMNAS_FISCALES = [
  "razon_social",
  "domicilio_fiscal",
  "email_fiscal",
  "imprenta_autorizada",
  "providencia_formas_libres",
] as const

function textoONull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null
}

/** Convierte una fila de `tenants` al DTO fiscal (con respaldos históricos). */
function aEntidadFiscal(fila: Record<string, unknown>): EntidadFiscal {
  const razonSocial = textoONull(fila.razon_social) ?? textoONull(fila.nombre) ?? ""
  const domicilioFiscal =
    textoONull(fila.domicilio_fiscal) ?? textoONull(fila.direccion) ?? ""
  return {
    tenantId: String(fila.id ?? ""),
    clinicSlug: String(fila.slug ?? ""),
    nombreComercial: textoONull(fila.nombre) ?? razonSocial,
    razonSocial,
    rif: textoONull(fila.rif) ?? "",
    domicilioFiscal,
    telefonoContacto: textoONull(fila.telefono),
    emailFiscal: textoONull(fila.email_fiscal),
    imprentaAutorizada: textoONull(fila.imprenta_autorizada),
    providenciaFormasLibres: textoONull(fila.providencia_formas_libres),
  }
}

/** ¿El error indica que la columna no existe (migración pendiente)? */
function esColumnaAusente(mensaje: string | undefined): boolean {
  return Boolean(
    mensaje &&
      (/column .* does not exist/i.test(mensaje) ||
        /Could not find the '.*' column/i.test(mensaje) ||
        /PGRST204/.test(mensaje))
  )
}

/** Datos fiscales de la clínica (siempre devuelve un DTO, aunque esté vacío). */
export async function leerEntidadFiscal(
  supabase: Client,
  tenantId: string
): Promise<AdminModuleResult<EntidadFiscal>> {
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        code: "SERVER_ERROR",
        message: `No se pudo leer la entidad fiscal: ${error.message}.`,
      }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La clínica no existe o tu usuario no tiene acceso.",
      }
    }

    return { ok: true, data: aEntidadFiscal(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al leer la entidad fiscal.",
    }
  }
}

/**
 * Guarda los datos fiscales validados. Requiere la migración 0016: si las
 * columnas fiscales no existen, informa en lugar de sobrescribir el nombre
 * comercial con la razón social.
 */
export async function guardarEntidadFiscal(
  supabase: Client,
  tenantId: string,
  entrada: unknown
): Promise<AdminModuleResult<EntidadFiscal>> {
  const valido = entidadFiscalSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const datos = valido.data
  const actual = await leerEntidadFiscal(supabase, tenantId)
  if (!actual.ok) return actual

  const payload: TenantUpdate = {
    razon_social: datos.razonSocial,
    rif: datos.rif,
    domicilio_fiscal: datos.domicilioFiscal,
    telefono: datos.telefonoContacto,
    email_fiscal: datos.emailFiscal,
    imprenta_autorizada: datos.imprentaAutorizada,
    providencia_formas_libres: datos.providenciaFormasLibres,
  }

  // Mantiene sincronizadas las columnas históricas usadas por la reserva.
  if (!actual.data.domicilioFiscal || actual.data.domicilioFiscal === datos.domicilioFiscal) {
    payload.direccion = datos.domicilioFiscal
  }

  const { data, error } = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", tenantId)
    .select("*")
    .maybeSingle()

  if (error) {
    if (esColumnaAusente(error.message)) {
      return {
        ok: false,
        code: "MIGRACION_PENDIENTE",
        message:
          "Falta aplicar la migración 0016_admin_module.sql: la base de datos aún no tiene las columnas fiscales (razon_social, domicilio_fiscal, email_fiscal…).",
      }
    }
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: `No se pudieron guardar los datos fiscales: ${error.message}.`,
    }
  }

  if (!data) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "Los datos fiscales no se guardaron: tu usuario no tiene permisos de administrador en esta clínica.",
    }
  }

  return { ok: true, data: aEntidadFiscal(data as Record<string, unknown>) }
}

/** Columnas fiscales declaradas (para diagnósticos y documentación). */
export function columnasFiscales(): readonly string[] {
  return COLUMNAS_FISCALES
}
