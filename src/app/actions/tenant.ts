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
 * 'admin' puede ejecutarla. Acepta el `tenantId` o el `clinicSlug` del slug:
 * si llega un slug, primero se resuelve el `id` real consultando `tenants`
 * por `.eq("slug", clinicSlug)` y el UPDATE se filtra por ese `id` canónico.
 * Si el esquema no tiene aún las columnas nuevas (PGRST204), reintenta con
 * un payload mínimo.
 */
export async function updateTenantSettings(
  input: UpdateTenantSettingsInput
): Promise<TenantSettingsResult<{ tenant: Tenant }>> {
  try {
    const tenantId = input.tenantId?.trim() || undefined
    const clinicSlug = input.clinicSlug?.trim() || undefined
    if (!tenantId && !clinicSlug) {
      return {
        ok: false,
        message: "Indica el slug o el identificador de la clínica.",
      }
    }

    const supabase = await createClient()

    // Resolución del tenant: PRIMERO por slug (clinicSlug) y, solo si el slug
    // no devuelve fila, fallback por id (tenantId). Así el `id` nunca se usa
    // cuando ya existe el slug canónico (evita incongruencias de UUID).
    let tenantTarget: { id: string; slug: string } | null = null
    let metaError: string | null = null

    if (clinicSlug) {
      const resultado = await supabase
        .from("tenants")
        .select("id, slug")
        .eq("slug", clinicSlug)
        .eq("is_active", true)
        .maybeSingle()
      tenantTarget = resultado.data
      metaError = resultado.error?.message ?? null
    }

    // Fallback a tenantId solo cuando el slug no matcheó (y no hubo error).
    if (!tenantTarget && !metaError && tenantId) {
      if (!UUID_RE.test(tenantId)) {
        return {
          ok: false,
          message: "El identificador de la clínica no es válido.",
        }
      }
      const resultado = await supabase
        .from("tenants")
        .select("id, slug")
        .eq("id", tenantId)
        .maybeSingle()
      tenantTarget = resultado.data
      metaError = resultado.error?.message ?? null
    }

    if (metaError) {
      console.error("[updateTenantSettings] Error al buscar la clínica:", {
        clinicSlug: clinicSlug ?? null,
        tenantId: tenantId ?? null,
        metaError,
      })
      return { ok: false, message: "No se pudo verificar la clínica." }
    }

    if (!tenantTarget) {
      // Facilita el depurado: registra exactamente qué slug/id recibió.
      console.error("[updateTenantSettings] Error al buscar clínica:", {
        input: {
          clinicSlug: clinicSlug ?? null,
          tenantId: tenantId ?? null,
        },
      })
      return {
        ok: false,
        message: "La clínica no se encontró para guardar la configuración.",
      }
    }

    const meta = tenantTarget

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

    // Depuración estricta: imprime exactamente lo que llegó del formulario.
    console.log("[updateTenantSettings] Payload recibido:", input.data)

    const guardar = async (payload: TenantUpdate, intento: number) => {
      console.log(
        `[updateTenantSettings] UPDATE intento ${intento} → payload:`,
        payload
      )
      const resultado = await supabase
        .from("tenants")
        .update(payload)
        .eq("id", meta.id)
        .select("*")
        .maybeSingle()

      if (resultado.error) {
        // Error exacto de Supabase/PostgREST antes de devolver al toast.
        console.error(
          `[updateTenantSettings] ERROR DE SUPABASE AL ACTUALIZAR (intento ${intento}):`,
          resultado.error
        )
      } else {
        // Respuesta cruda de PostgreSQL tras el UPDATE (debe traer la fila).
        console.log(
          `[updateTenantSettings] Resultado de PostgreSQL tras UPDATE (intento ${intento}):`,
          resultado.data
        )
      }
      return resultado
    }

    let resultado = await guardar(payloadCompleto, 1)
    // Esquema sin migrar (columnas nuevas no existen) → reintento mínimo.
    if (resultado.error?.code === "PGRST204") {
      console.warn(
        "[updateTenantSettings] Columnas nuevas ausentes (PGRST204) → reintento con payload mínimo."
      )
      resultado = await guardar(payloadMinimo, 2)
    }

    if (resultado.error) {
      // El detalle exacto ya se imprimió en consola; propaga prefijo BD.
      return {
        ok: false,
        message: `Error en BD: ${resultado.error.message}`,
      }
    }

    // Persistencia: `maybeSingle` devuelve null si PostgreSQL afectó 0 filas.
    // La fila ya existía (meta), así que aquí implica bloqueo por RLS.
    if (!resultado.data) {
      console.error(
        "[updateTenantSettings] UPDATE afectó 0 filas (posible bloqueo RLS):",
        { slug: meta.slug, tenantId: meta.id, payloadRecibido: input.data }
      )
      return {
        ok: false,
        message:
          "No tienes permisos de administrador para guardar cambios en esta clínica.",
      }
    }
    const tenantActualizado = resultado.data

    // Prueba de persistencia: confirma los valores tal como quedaron en BD.
    console.log(
      "[updateTenantSettings] Persistencia verificada → tenant actualizado:",
      {
        id: tenantActualizado.id,
        slug: tenantActualizado.slug,
        nombre: tenantActualizado.nombre,
        rif: tenantActualizado.rif,
        direccion: tenantActualizado.direccion,
        telefono: tenantActualizado.telefono,
        pago_movil_enabled: tenantActualizado.pago_movil_enabled,
        max_slots_per_shift: tenantActualizado.max_slots_per_shift,
      }
    )

    // Revalida la página Server Component de configuración y la raíz de la
    // clínica para que Next.js no sirva datos en caché desactualizados.
    revalidatePath(`/${meta.slug}/admin/configuracion`)
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

    revalidatePath(`/${meta.slug}/admin/configuracion`)
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
