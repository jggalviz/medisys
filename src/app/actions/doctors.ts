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
      nombre: input.nombre.trim(),
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: input.especialidad.trim(),
      cedula: input.cedula?.trim() || null,
      telefono: input.telefono?.trim() || null,
      activo,
      is_active: activo,
      dias_atencion: input.dias_atencion,
      turno_habitual: input.turno_habitual,
    }

    const { data, error } = await supabase
      .from("doctors")
      .insert(payload)
      .select("*")
      .single()

    if (error || !data) {
      return { ok: false, message: error?.message ?? "No se pudo crear." }
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
    const payload: DoctorUpdate = {
      nombre: input.nombre.trim(),
      nombres: partes.nombres,
      apellidos: partes.apellidos,
      especialidad: input.especialidad.trim(),
      cedula: input.cedula?.trim() || null,
      telefono: input.telefono?.trim() || null,
      activo,
      is_active: activo,
      dias_atencion: input.dias_atencion,
      turno_habitual: input.turno_habitual,
    }

    const { data, error } = await supabase
      .from("doctors")
      .update(payload)
      .eq("id", especialistaId)
      .eq("tenant_id", ctx.data.tenantId)
      .select("*")
      .single()

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "No se pudo actualizar.",
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
      .single()

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