/**
 * MEDISYS · Sedes del tenant (estructura multi-sede)
 * -----------------------------------------------------------------
 * CRUD de `sedes` (migración 0016). Un usuario puede quedar vinculado a una o
 * varias sedes vía `tenant_users.sede_ids` (ver `@/lib/rbac` y `staff.ts`).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult, SedeDTO } from "@/types/admin"
import type { Database, SedeInsert } from "@/types/database"
import { sedeSchema } from "@/lib/validations/admin"

type Client = SupabaseClient<Database>

type CodigoSede =
  | "MIGRACION_PENDIENTE"
  | "CONFLICT"
  | "NOT_FOUND"
  | "SERVER_ERROR"

const COLUMNAS = "*"

function textoONull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null
}

/** Fila de BD → DTO camelCase. */
export function aSedeDTO(fila: Record<string, unknown>): SedeDTO {
  return {
    id: String(fila.id ?? ""),
    tenantId: String(fila.tenant_id ?? ""),
    nombre: String(fila.nombre ?? ""),
    direccion: textoONull(fila.direccion),
    telefono: textoONull(fila.telefono),
    esPrincipal: Boolean(fila.es_principal),
    activo: fila.activo === undefined ? true : Boolean(fila.activo),
    createdAt: String(fila.created_at ?? ""),
  }
}

/** Traduce errores de Postgres/PostgREST a código + mensaje accionable. */
export function interpretarErrorSedes(error: {
  code?: string
  message?: string
}): { codigo: CodigoSede; message: string } {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return {
      codigo: "MIGRACION_PENDIENTE",
      message:
        "Falta aplicar la migración 0016_admin_module.sql: la tabla sedes aún no existe en la base de datos.",
    }
  }
  if (error.code === "23505") {
    return {
      codigo: "CONFLICT",
      message: "Ya existe una sede con ese nombre en esta clínica.",
    }
  }
  return {
    codigo: "SERVER_ERROR",
    message: `No se pudo completar la operación: ${error.message ?? "error desconocido"}.`,
  }
}

/** Sedes de la clínica ordenadas por principal y nombre. */
export async function listarSedes(
  supabase: Client,
  tenantId: string
): Promise<AdminModuleResult<SedeDTO[]>> {
  try {
    const { data, error } = await supabase
      .from("sedes")
      .select(COLUMNAS)
      .eq("tenant_id", tenantId)
      .order("es_principal", { ascending: false })
      .order("nombre", { ascending: true })

    if (error) {
      const info = interpretarErrorSedes(error)
      return { ok: false, code: info.codigo, message: info.message }
    }

    return {
      ok: true,
      data: (data ?? []).map((fila) => aSedeDTO(fila as Record<string, unknown>)),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar las sedes.",
    }
  }
}

/**
 * Crea una sede. Si se marca `esPrincipal`, se degrada la anterior para
 * mantener una sola sede principal por clínica.
 */
export async function crearSede(
  supabase: Client,
  tenantId: string,
  entrada: unknown
): Promise<AdminModuleResult<SedeDTO>> {
  const valido = sedeSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const datos = valido.data

  try {
    if (datos.esPrincipal) {
      await supabase
        .from("sedes")
        .update({ es_principal: false })
        .eq("tenant_id", tenantId)
        .eq("es_principal", true)
    }

    const payload: SedeInsert = {
      tenant_id: tenantId,
      nombre: datos.nombre,
      direccion: datos.direccion,
      telefono: datos.telefono,
      es_principal: datos.esPrincipal,
      activo: datos.activo,
    }

    const { data, error } = await supabase
      .from("sedes")
      .insert(payload)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorSedes(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "La sede no se guardó: tu usuario no tiene permisos de administrador en esta clínica.",
      }
    }

    return { ok: true, data: aSedeDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al crear la sede.",
    }
  }
}

/** Actualiza una sede existente (nombre, dirección, teléfono, estado). */
export async function actualizarSede(
  supabase: Client,
  tenantId: string,
  sedeId: string,
  entrada: unknown
): Promise<AdminModuleResult<SedeDTO>> {
  const valido = sedeSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const datos = valido.data

  try {
    if (datos.esPrincipal) {
      await supabase
        .from("sedes")
        .update({ es_principal: false })
        .eq("tenant_id", tenantId)
        .eq("es_principal", true)
        .neq("id", sedeId)
    }

    const { data, error } = await supabase
      .from("sedes")
      .update({
        nombre: datos.nombre,
        direccion: datos.direccion,
        telefono: datos.telefono,
        es_principal: datos.esPrincipal,
        activo: datos.activo,
      })
      .eq("id", sedeId)
      .eq("tenant_id", tenantId)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorSedes(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "La sede no existe en esta clínica o tu usuario no tiene permisos para editarla.",
      }
    }

    return { ok: true, data: aSedeDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al actualizar la sede.",
    }
  }
}

/** Activa o desactiva una sede (baja lógica). */
export async function alternarSede(
  supabase: Client,
  tenantId: string,
  sedeId: string,
  activo: boolean
): Promise<AdminModuleResult<SedeDTO>> {
  try {
    const { data, error } = await supabase
      .from("sedes")
      .update({ activo })
      .eq("id", sedeId)
      .eq("tenant_id", tenantId)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorSedes(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La sede no existe en esta clínica.",
      }
    }
    return { ok: true, data: aSedeDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al cambiar el estado de la sede.",
    }
  }
}

/** Elimina una sede (requiere rol administrador vía RLS). */
export async function eliminarSede(
  supabase: Client,
  tenantId: string,
  sedeId: string
): Promise<AdminModuleResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from("sedes")
      .delete()
      .eq("id", sedeId)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle()

    if (error) {
      const info = interpretarErrorSedes(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "La sede no existe en esta clínica o tu usuario no tiene permisos para eliminarla.",
      }
    }
    return { ok: true, data: { id: String(data.id) } }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al eliminar la sede.",
    }
  }
}

