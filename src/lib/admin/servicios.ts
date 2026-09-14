/**
 * MEDISYS · Catálogo de servicios médicos y honorarios
 * -----------------------------------------------------------------
 * CRUD de `medical_services` (migración 0016) con validación compartida
 * (`servicioMedicoSchema`) y resultados discriminados para las API.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult, ServicioMedicoDTO } from "@/types/admin"
import type { Database } from "@/types/database"
import { servicioMedicoSchema } from "@/lib/validations/admin"

type Client = SupabaseClient<Database>

/** Código de error tipado de la operación. */
type CodigoServicio =
  | "MIGRACION_PENDIENTE"
  | "CONFLICT"
  | "NOT_FOUND"
  | "SERVER_ERROR"

const COLUMNAS = "*"

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

/** Fila de BD → DTO camelCase que consumen API y UI. */
export function aServicioDTO(fila: Record<string, unknown>): ServicioMedicoDTO {
  return {
    id: String(fila.id ?? ""),
    tenantId: String(fila.tenant_id ?? ""),
    title: String(fila.title ?? ""),
    code: String(fila.code ?? ""),
    priceUSD: numero(fila.price_usd),
    taxable: Boolean(fila.taxable),
    doctorCommissionType:
      fila.doctor_commission_type === "FIXED" ? "FIXED" : "PERCENTAGE",
    doctorCommissionValue: numero(fila.doctor_commission_value),
    doctorId: typeof fila.doctor_id === "string" ? fila.doctor_id : null,
    activo: fila.activo === undefined ? true : Boolean(fila.activo),
    createdAt: String(fila.created_at ?? ""),
  }
}

/** Traduce errores de Postgres/PostgREST a un código y mensaje accionable. */
export function interpretarErrorServicios(error: {
  code?: string
  message?: string
}): { codigo: CodigoServicio; message: string } {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return {
      codigo: "MIGRACION_PENDIENTE",
      message:
        "Falta aplicar la migración 0016_admin_module.sql: la tabla medical_services aún no existe en la base de datos.",
    }
  }
  if (error.code === "23505") {
    return {
      codigo: "CONFLICT",
      message:
        "Ya existe un servicio con ese código en esta clínica. Usa un código diferente.",
    }
  }
  if (error.code === "23503") {
    return {
      codigo: "NOT_FOUND",
      message: "El especialista seleccionado no existe en esta clínica.",
    }
  }
  return {
    codigo: "SERVER_ERROR",
    message: `No se pudo completar la operación: ${error.message ?? "error desconocido"}.`,
  }
}

/** Lista el catálogo de servicios de la clínica (activos e inactivos). */
export async function listarServicios(
  supabase: Client,
  tenantId: string
): Promise<AdminModuleResult<ServicioMedicoDTO[]>> {
  try {
    const { data, error } = await supabase
      .from("medical_services")
      .select(COLUMNAS)
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true })

    if (error) {
      const info = interpretarErrorServicios(error)
      return { ok: false, code: info.codigo, message: info.message }
    }

    return {
      ok: true,
      data: (data ?? []).map((fila) =>
        aServicioDTO(fila as Record<string, unknown>)
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar los servicios.",
    }
  }
}

/** Campos mutables de un servicio (sin `tenant_id`, que no se reasigna). */
type CamposServicio = {
  title: string
  code: string
  price_usd: number
  taxable: boolean
  doctor_commission_type: "PERCENTAGE" | "FIXED"
  doctor_commission_value: number
  doctor_id: string | null
  activo: boolean
}

function camposServicio(datos: {
  title: string
  code: string
  priceUSD: number
  taxable: boolean
  doctorCommissionType: "PERCENTAGE" | "FIXED"
  doctorCommissionValue: number
  doctorId: string | null
  activo: boolean
}): CamposServicio {
  return {
    title: datos.title,
    code: datos.code,
    price_usd: datos.priceUSD,
    taxable: datos.taxable,
    doctor_commission_type: datos.doctorCommissionType,
    doctor_commission_value: datos.doctorCommissionValue,
    doctor_id: datos.doctorId,
    activo: datos.activo,
  }
}

/** Crea un servicio validado (código único por clínica). */
export async function crearServicio(
  supabase: Client,
  tenantId: string,
  entrada: unknown
): Promise<AdminModuleResult<ServicioMedicoDTO>> {
  const valido = servicioMedicoSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  try {
    const { data, error } = await supabase
      .from("medical_services")
      .insert({ tenant_id: tenantId, ...camposServicio(valido.data) })
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorServicios(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "El servicio no se guardó: tu usuario no tiene permisos de administrador en esta clínica.",
      }
    }

    return { ok: true, data: aServicioDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al crear el servicio.",
    }
  }
}

/** Actualiza un servicio existente del tenant. */
export async function actualizarServicio(
  supabase: Client,
  tenantId: string,
  servicioId: string,
  entrada: unknown
): Promise<AdminModuleResult<ServicioMedicoDTO>> {
  const valido = servicioMedicoSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const cambios = camposServicio(valido.data)

  try {
    const { data, error } = await supabase
      .from("medical_services")
      .update(cambios)
      .eq("id", servicioId)
      .eq("tenant_id", tenantId)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorServicios(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "El servicio no existe en esta clínica o tu usuario no tiene permisos para editarlo.",
      }
    }

    return { ok: true, data: aServicioDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al actualizar el servicio.",
    }
  }
}

/** Activa o desactiva un servicio (baja lógica sin perder historial). */
export async function alternarServicio(
  supabase: Client,
  tenantId: string,
  servicioId: string,
  activo: boolean
): Promise<AdminModuleResult<ServicioMedicoDTO>> {
  try {
    const { data, error } = await supabase
      .from("medical_services")
      .update({ activo })
      .eq("id", servicioId)
      .eq("tenant_id", tenantId)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorServicios(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "El servicio no existe en esta clínica.",
      }
    }
    return { ok: true, data: aServicioDTO(data as Record<string, unknown>) }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al cambiar el estado del servicio.",
    }
  }
}

/** Elimina el servicio del catálogo (requiere rol administrador vía RLS). */
export async function eliminarServicio(
  supabase: Client,
  tenantId: string,
  servicioId: string
): Promise<AdminModuleResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from("medical_services")
      .delete()
      .eq("id", servicioId)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle()

    if (error) {
      const info = interpretarErrorServicios(error)
      return { ok: false, code: info.codigo, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "El servicio no existe en esta clínica o tu usuario no tiene permisos para eliminarlo.",
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
          : "Error inesperado al eliminar el servicio.",
    }
  }
}


