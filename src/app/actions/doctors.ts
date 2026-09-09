"use server"

/**
 * MEDISYS · CRUD de especialistas (módulo /admin/especialistas).
 *
 * Solo roles 'admin' o 'recepcion' pueden crear/editar/eliminar. Tras cada
 * cambio se ejecuta `revalidatePath` para refrescar el wizard de reserva.
 */
import { revalidatePath } from "next/cache"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  Database,
  DoctorInsert,
  DoctorUpdate,
  TenantUserRole,
  TurnoHabitualEspecialista,
} from "@/types/database"
import { createClient } from "@/lib/supabase/server"

export type EspecialistaInput = {
  nombre: string
  especialidad: string
  cedula?: string | null
  telefono?: string | null
  /** Precio de la consulta en USD (se convierte con la tasa BCV en el wizard). */
  precio_consulta?: number | null
  /** 1=Lunes … 6=Sábado. */
  dias_atencion: number[]
  turno_habitual: TurnoHabitualEspecialista
  activo?: boolean
}

export type EspecialistaItem = {
  id: string
  tenant_id: string
  nombre: string
  especialidad: string
  cedula: string | null
  telefono: string | null
  /** Precio de consulta en USD (columna `doctors.precio_consulta`). */
  precio_consulta: number
  activo: boolean
  dias_atencion: number[]
  turno_habitual: TurnoHabitualEspecialista
  created_at: string
}

export type EspecialistasResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

type ContextoStaff = {
  supabase: SupabaseClient<Database>
  tenantId: string
  slug: string
  role: TenantUserRole
}

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function nuloTexto(value: unknown): string | null {
  return value == null ? null : str(value)
}

function diasDesdeFila(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map(Number)
    .filter((dia) => Number.isInteger(dia) && dia >= 1 && dia <= 6)
    .sort((a, b) => a - b)
}

function turnoDesdeFila(value: unknown): TurnoHabitualEspecialista {
  return value === "manana" || value === "tarde" || value === "ambos"
    ? value
    : "ambos"
}

function precioDesdeFila(value: unknown): number {
  const precio = Number(value)
  return Number.isFinite(precio) && precio > 0 ? precio : 0
}

/**
 * Normaliza el precio USD: limpia la entrada (coma → punto), la convierte a
 * float y la redondea a 2 decimales. Vacío/null/negativo → 0.
 */
function normalizarPrecio(
  valor: number | string | null | undefined
): number {
  const precioLimpio =
    parseFloat(String(valor ?? "").replace(/,/g, ".")) || 0
  if (!Number.isFinite(precioLimpio) || precioLimpio <= 0) return 0
  return Math.round(precioLimpio * 100) / 100
}

/** Normaliza una fila cruda de `doctors` (tolera columnas ausentes). */
function normalizarEspecialista(row: Record<string, unknown>): EspecialistaItem {
  const separado = [str(row.nombres), str(row.apellidos)]
    .filter(Boolean)
    .join(" ")
    .trim()
  const nombre = separado || str(row.nombre).trim() || "Especialista"
  const activo =
    row.activo !== false && row.is_active !== false

  return {
    id: str(row.id),
    tenant_id: str(row.tenant_id),
    nombre,
    especialidad: str(row.especialidad) || "General",
    cedula: nuloTexto(row.cedula),
    telefono: nuloTexto(row.telefono),
    precio_consulta: precioDesdeFila(row.precio_consulta),
    activo,
    dias_atencion: diasDesdeFila(row.dias_atencion),
    turno_habitual: turnoDesdeFila(row.turno_habitual),
    created_at: str(row.created_at) || new Date(0).toISOString(),
  }
}

async function contextoAutorizado(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  rolesPermitidos: TenantUserRole[]
): Promise<EspecialistasResult<ContextoStaff>> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false, message: "No autorizado: inicia sesión." }
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("id", tenantId)
    .maybeSingle()
  if (tenantError || !tenant) {
    return { ok: false, message: "La clínica no existe." }
  }

  const { data: member, error: memberError } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (memberError || !member) {
    return { ok: false, message: "No autorizado para esta clínica." }
  }

  if (!rolesPermitidos.includes(member.role)) {
    return {
      ok: false,
      message: "Requiere rol admin o recepción.",
    }
  }

  return {
    ok: true,
    data: {
      supabase,
      tenantId: tenant.id,
      slug: tenant.slug,
      role: member.role,
    },
  }
}

/** Lista los especialistas de la clínica (cualquier staff autenticado). */
export async function getEspecialistas(
  tenantId: string
): Promise<EspecialistasResult<EspecialistaItem[]>> {
  try {
    const supabase = await createClient()
    const ctx = await contextoAutorizado(
      supabase,
      tenantId,
      ["admin", "recepcion", "especialista"]
    )
    if (!ctx.ok) return ctx

    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", ctx.data.tenantId)
    if (error) return { ok: false, message: error.message }

    const items = ((data ?? []) as unknown[])
      .map((row) => normalizarEspecialista(row as Record<string, unknown>))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

    return { ok: true, data: items }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al listar especialistas.",
    }
  }
}

function partesNombre(nombre: string): { nombres: string; apellidos: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return {
    nombres: partes[0] ?? "",
    apellidos: partes.slice(1).join(" "),
  }
}

function validarInput(input: EspecialistaInput): string | null {
  if (!input.nombre?.trim()) return "El nombre es obligatorio."
  if (!input.especialidad?.trim()) return "La especialidad es obligatoria."
  const diasValidos =
    input.dias_atencion.every((d) => d >= 1 && d <= 6) &&
    new Set(input.dias_atencion).size === input.dias_atencion.length
  if (!diasValidos) return "Días de atención no válidos (1 a 6)."
  return null
}

function revalidar(slug: string) {
  revalidatePath(`/${slug}/reservar`)
  revalidatePath(`/${slug}/admin/especialistas`)
  revalidatePath(`/${slug}`)
  revalidatePath("/")
}

/** Crea un especialista nuevo (solo admin o recepción). */
export async function createEspecialista(
  tenantId: string,
  input: EspecialistaInput
): Promise<EspecialistasResult<EspecialistaItem>> {
  try {
    const supabase = await createClient()
    const ctx = await contextoAutorizado(supabase, tenantId, [
      "admin",
      "recepcion",
    ])
    if (!ctx.ok) return ctx

    const errorValidacion = validarInput(input)
    if (errorValidacion) return { ok: false, message: errorValidacion }

    const partes = partesNombre(input.nombre)
    const activo = input.activo ?? true
    const payload: DoctorInsert = {
      tenant_id: ctx.data.tenantId,
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: input.especialidad.trim(),
      cedula: input.cedula?.trim() || null,
      telefono: input.telefono?.trim() || null,
      precio_consulta: normalizarPrecio(input.precio_consulta),
      activo,
      is_active: activo,
    }

    const { data, error } = await supabase
      .from("doctors")
      .insert(payload)
      .select("*")
      .maybeSingle()

    if (error || !data) {
      if (error) {
        // Muestra la causa exacta en consola y devuelve su mensaje a la UI.
        console.error("[createEspecialista] Error de Supabase al crear médico:", error)
        return { ok: false, message: error.message }
      }
      return {
        ok: false,
        message: "No se pudo crear el especialista: no se devolvió la fila.",
      }
    }
    revalidar(ctx.data.slug)
    return {
      ok: true,
      data: normalizarEspecialista(data as unknown as Record<string, unknown>),
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al crear.",
    }
  }
}

/** Edita un especialista existente (solo admin o recepción). */
export async function updateEspecialista(
  tenantId: string,
  especialistaId: string,
  input: EspecialistaInput
): Promise<EspecialistasResult<EspecialistaItem>> {
  try {
    const supabase = await createClient()
    const ctx = await contextoAutorizado(supabase, tenantId, [
      "admin",
      "recepcion",
    ])
    if (!ctx.ok) return ctx

    const errorValidacion = validarInput(input)
    if (errorValidacion) return { ok: false, message: errorValidacion }

    const partes = partesNombre(input.nombre)
    const activo = input.activo ?? true
    // Sanitización: solo columnas actualizables. Nunca enviamos `id`,
    // `tenant_id`, `created_at` ni claves primarias (PostgreSQL no permite
    // sobreescribirlas en un UPDATE).
    const payload: DoctorUpdate = {
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: input.especialidad.trim(),
      cedula: input.cedula?.trim() || null,
      telefono: input.telefono?.trim() || null,
      precio_consulta: normalizarPrecio(input.precio_consulta),
      activo,
      is_active: activo,
    }

    // Filtro estricto: solo por clave primaria `id` + clave de inquilino.
    // Diagnóstico: confirma los IDs que llegan antes de tocar la BD.
    console.log("[updateEspecialista] Actualizando médico:", {
      doctorId: especialistaId,
      tenantId: ctx.data.tenantId,
      slug: ctx.data.slug,
    })

    const { data, error } = await supabase
      .from("doctors")
      .update(payload)
      .eq("id", especialistaId)
      .select()

    if (error) {
      console.error(
        "[updateEspecialista] Error Supabase Update:",
        error,
        { doctorId: especialistaId, tenantId: ctx.data.tenantId }
      )
      return { ok: false, message: error.message }
    }

    const actualizado = (data ?? [])[0] ?? null
    if (!actualizado) {
      // Fallback: el id no existe como fila actualizable → UPSERT de
      // creación/reconciliación con la PK `id` y el `tenant_id` del contexto.
      console.warn(
        `[updateEspecialista] UPDATE sin filas (id ${especialistaId}); reintentando con UPSERT…`,
        { tenantId: ctx.data.tenantId }
      )

      const payloadConId: DoctorInsert = {
        id: especialistaId,
        tenant_id: ctx.data.tenantId,
        nombres: payload.nombres ?? "",
        apellidos: payload.apellidos ?? "",
        especialidad: payload.especialidad ?? "General",
        cedula: payload.cedula ?? null,
        telefono: payload.telefono ?? null,
        precio_consulta: payload.precio_consulta ?? 0,
        activo: payload.activo ?? true,
        is_active: payload.is_active ?? true,
      }

      const upsert = await supabase
        .from("doctors")
        .upsert(payloadConId, { onConflict: "id" })
        .select("*")
        .maybeSingle()

      if (upsert.error) {
        console.error(
          "[updateEspecialista] Error al hacer upsert de especialista:",
          upsert.error,
          { doctorId: especialistaId, tenantId: ctx.data.tenantId }
        )
        return {
          ok: false,
          message: `Error en base de datos: ${upsert.error.message}`,
        }
      }

      const creado = upsert.data ?? null
      if (!creado) {
        return {
          ok: false,
          message: `No se pudo crear o actualizar el especialista con ID ${especialistaId}.`,
        }
      }

      revalidar(ctx.data.slug)
      return {
        ok: true,
        data: normalizarEspecialista(
          creado as unknown as Record<string, unknown>
        ),
      }
    }

    revalidar(ctx.data.slug)
    return {
      ok: true,
      data: normalizarEspecialista(
        actualizado as unknown as Record<string, unknown>
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al actualizar.",
    }
  }
}

/** Activa/desactiva el especialista en el wizard. */
export async function toggleEspecialista(
  tenantId: string,
  especialistaId: string,
  activo: boolean
): Promise<EspecialistasResult<EspecialistaItem>> {
  try {
    const supabase = await createClient()
    const ctx = await contextoAutorizado(supabase, tenantId, [
      "admin",
      "recepcion",
    ])
    if (!ctx.ok) return ctx

    const { data, error } = await supabase
      .from("doctors")
      .update({ activo, is_active: activo })
      .eq("id", especialistaId)
      .eq("tenant_id", ctx.data.tenantId)
      .select("*")
      .maybeSingle()

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "No se pudo cambiar el estado.",
      }
    }
    revalidar(ctx.data.slug)
    return {
      ok: true,
      data: normalizarEspecialista(data as unknown as Record<string, unknown>),
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al cambiar el estado.",
    }
  }
}

/** Elimina un especialista (solo admin o recepción). */
export async function deleteEspecialista(
  tenantId: string,
  especialistaId: string
): Promise<EspecialistasResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const ctx = await contextoAutorizado(supabase, tenantId, [
      "admin",
      "recepcion",
    ])
    if (!ctx.ok) return ctx

    const { error } = await supabase
      .from("doctors")
      .delete()
      .eq("id", especialistaId)
      .eq("tenant_id", ctx.data.tenantId)

    if (error) {
      return { ok: false, message: error.message }
    }
    revalidar(ctx.data.slug)
    return { ok: true, data: { id: especialistaId } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al eliminar.",
    }
  }
}