"use server"

/**
 * MEDISYS · Contexto de tenant para las rutas dinámicas por `[clinicSlug]`.
 *
 * Todas las páginas de reserva y administración resuelven aquí la clínica
 * activa y pasan su `id` a las Server Actions correspondientes, sin depender
 * de query params como `?tenantId=`.
 */
import { revalidatePath } from "next/cache"

import type { Tenant, TenantUpdate } from "@/types/database"
import type {
  TenantSettingsResult,
  UpdateTenantSettingsInput,
} from "@/types/admin"
import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"

/**
 * Busca el tenant activo por su slug.
 * Devuelve `null` si no existe o si `is_active` es false (→ la página debe
 * renderizar notFound()).
 */
export async function getTenantBySlug(
  slug: string
): Promise<Tenant | null> {
  if (!slug?.trim()) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle()

  if (error) return null
  return data ?? null
}

/* ------------------------------------------------------------------ */
/* Configuración del tenant (solo rol admin)                           */
/* ------------------------------------------------------------------ */

/** Normaliza el límite: 0 / vacío → null (ilimitado). */
function normalizarLimite(valor: number | null | undefined): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null
  return valor > 0 ? Math.floor(valor) : null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Actualiza la configuración operativa del tenant. Solo el personal con rol
 * 'admin' puede ejecutarla. Si el esquema no tiene aún las columnas nuevas
 * (PGRST204), reintenta con un payload mínimo.
 */
export async function updateTenantSettings(
  input: UpdateTenantSettingsInput
): Promise<TenantSettingsResult<{ tenant: Tenant }>> {
  try {
    const tenantId = input.tenantId?.trim()
    if (!tenantId) {
      return { ok: false, message: "Falta el identificador del tenant." }
    }
    if (!UUID_RE.test(tenantId)) {
      return { ok: false, message: "El identificador del tenant no es válido." }
    }

    const supabase = await createClient()

    const { data: meta, error: metaError } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("id", tenantId)
      .maybeSingle()
    if (metaError || !meta) {
      return { ok: false, message: "La clínica no existe." }
    }

    const staff = await getStaffForSlug(supabase, meta.slug)
    if (!staff) {
      return { ok: false, message: "No autorizado: inicia sesión." }
    }
    if (staff.role !== "admin") {
      return {
        ok: false,
        message: "Solo el administrador puede modificar la configuración.",
      }
    }

    const data = input.data
    const nombre = data.nombre?.trim()
    if (!nombre) {
      return { ok: false, message: "El nombre de la clínica es obligatorio." }
    }

    const datosPago = data.datos_pago_movil ?? null
    const maxSlots = normalizarLimite(data.max_slots_per_shift)

    const payloadCompleto: TenantUpdate = {
      nombre,
      rif: data.rif?.trim() || null,
      direccion: data.direccion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      pago_movil_enabled: data.pago_movil_enabled,
      max_slots_per_shift: maxSlots,
      datos_pago_movil: datosPago,
    }
    const payloadMinimo: TenantUpdate = {
      nombre,
      datos_pago_movil: datosPago,
    }

    const guardar = async (payload: TenantUpdate) =>
      supabase
        .from("tenants")
        .update(payload)
        .eq("id", tenantId)
        .select("*")
        .maybeSingle()

    let resultado = await guardar(payloadCompleto)
    // Esquema sin migrar (columnas nuevas no existen) → solo campos base.
    if (resultado.error?.code === "PGRST204") {
      resultado = await guardar(payloadMinimo)
    }

    if (resultado.error) {
      return {
        ok: false,
        message:
          resultado.error.message ?? "No se pudo guardar la configuración.",
      }
    }

    // `maybeSingle` devuelve `null` cuando la fila no existe (0 filas).
    if (!resultado.data) {
      return {
        ok: false,
        message: "La clínica no se encontró para guardar la configuración.",
      }
    }
    const tenantActualizado = resultado.data

    // Refresca el wizard público y la raíz de la clínica inmediatamente.
    revalidatePath(`/${meta.slug}/reservar`)
    revalidatePath(`/${meta.slug}`)
    revalidatePath("/")

    return { ok: true, data: { tenant: tenantActualizado } }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Error inesperado al guardar."
    return { ok: false, message }
  }
}

/** Extensión del archivo de logo según su content-type. */
function extensionDeImagen(contentType: string): string {
  const mapa: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  }
  return mapa[contentType] ?? "png"
}

/**
 * Sube el logo oficial de la clínica al bucket 'branding' y actualiza
 * `tenants.logo_url`. Solo rol 'admin'.
 */
export async function uploadTenantLogo(
  tenantId: string,
  formData: FormData
): Promise<TenantSettingsResult<{ logoUrl: string | null; tenant: Tenant }>> {
  try {
    const file = formData.get("logo")
    if (!(file instanceof File)) {
      return { ok: false, message: "Selecciona un archivo de imagen." }
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "El logo debe ser una imagen." }
    }
    if (file.size > 3 * 1024 * 1024) {
      return { ok: false, message: "El logo debe pesar menos de 3 MB." }
    }

    const supabase = await createClient()

    const { data: meta, error: metaError } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("id", tenantId)
      .maybeSingle()
    if (metaError || !meta) {
      return { ok: false, message: "La clínica no existe." }
    }

    const staff = await getStaffForSlug(supabase, meta.slug)
    if (!staff || staff.role !== "admin") {
      return {
        ok: false,
        message: "Solo el administrador puede cambiar el logo.",
      }
    }

    const extension = extensionDeImagen(file.type)
    const path = `branding/${tenantId}/${Date.now()}-logo.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from("branding")
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      })

    if (uploadError) {
      return {
        ok: false,
        message: `No se pudo subir el logo: ${uploadError.message}. Verifica que exista el bucket público 'branding'.`,
      }
    }

    const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path)
    const logoUrl = urlData.publicUrl

    const { data: tenant, error: updateError } = await supabase
      .from("tenants")
      .update({ logo_url: logoUrl })
      .eq("id", tenantId)
      .select("*")
      .maybeSingle()

    if (updateError) {
      return {
        ok: false,
        message: updateError.message ?? "No se pudo actualizar el logo.",
      }
    }
    if (!tenant) {
      return {
        ok: false,
        message: "La clínica no se encontró para guardar el logo.",
      }
    }

    revalidatePath(`/${meta.slug}/reservar`)
    revalidatePath(`/${meta.slug}`)
    revalidatePath("/")

    return { ok: true, data: { logoUrl, tenant } }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Error inesperado al subir el logo."
    return { ok: false, message }
  }
}
