"use server"

/**
 * MEDISYS · Contexto de clínica para las rutas dinámicas por `[clinicSlug]`.
 *
 * Todas las páginas de reserva y administración resuelven aquí la clínica
 * activa y pasan su `id` a las Server Actions correspondientes, sin depender
 * de query params como `?tenantId=`.
 */
import { revalidatePath } from "next/cache"

import type {
  CuentaCobro,
  DatosPagoMovil,
  Tenant,
  TenantUpdate,
} from "@/types/database"
import type {
  TenantSettingsResult,
  UpdateTenantSettingsInput,
} from "@/types/admin"
import { createClient } from "@/lib/supabase/server"
import { normalizarThemeConfig } from "@/lib/theme"
import { createAdminClient } from "@/lib/supabase/admin"
import { asegurarBucketPublico, BUCKET_BRANDING } from "@/lib/supabase/storage"
import { getStaffForSlug } from "@/lib/staff"

/**
 * Busca la clínica activa por su slug.
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
/* Configuración de la clínica (solo rol admin)                        */
/* ------------------------------------------------------------------ */

/** Normaliza el límite: 0 / vacío → null (ilimitado). */
function normalizarLimite(valor: number | null | undefined): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null
  return valor > 0 ? Math.floor(valor) : null
}

/**
 * Unifica el JSONB `datos_pago_movil` a la estructura dinámica compartida:
 * `{ cuentas: CuentaCobro[], instrucciones: string | null }`.
 *
 * Acepta y migra dos formas de entrada:
 *  1. Forma nueva del Admin: `{ cuentas: [...], instrucciones }`.
 *  2. Forma plana/legacy: `{ banco, telefono, cedula|cedula_rif, titular,
 *     instrucciones }` → la envuelve en un arreglo `cuentas` con un solo ítem.
 */
function normalizarDatosPagoMovil(value: unknown): DatosPagoMovil | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const texto = (v: unknown): string =>
    typeof v === "string" ? v.trim() : ""

  const listaRecibida = Array.isArray(raw.cuentas)
    ? (raw.cuentas as unknown[]).filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
    : []

  const normalizarCuenta = (cuenta: Record<string, unknown>): CuentaCobro => {
    const metodo = cuenta.metodo === "zelle" ? "zelle" : "pago_movil"
    return {
      metodo,
      banco: texto(cuenta.banco) || null,
      titular: texto(cuenta.titular),
      cedula_rif:
        texto(cuenta.cedula_rif) || texto(cuenta.cedula) || null,
      telefono: texto(cuenta.telefono) || null,
      correo_zelle: texto(cuenta.correo_zelle) || null,
    }
  }

  // 1) Arreglo `cuentas` (forma nueva): se conserva y normaliza tal cual.
  const cuentasNormalizadas = listaRecibida.map(normalizarCuenta)

  // 2) Si no vino un arreglo, deriva una cuenta desde campos planos.
  const tieneCuentaPlana = Boolean(texto(raw.banco) && texto(raw.telefono))
  const cuentas: CuentaCobro[] =
    cuentasNormalizadas.length > 0
      ? cuentasNormalizadas
      : tieneCuentaPlana
        ? ([
            {
              metodo: "pago_movil",
              banco: texto(raw.banco) || null,
              titular: texto(raw.titular),
              cedula_rif:
                texto(raw.cedula_rif) || texto(raw.cedula) || null,
              telefono: texto(raw.telefono) || null,
              correo_zelle: null,
            },
          ] as CuentaCobro[])
        : []

  return {
    cuentas,
    instrucciones: texto(raw.instrucciones) || null,
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Actualiza la configuración operativa de la clínica. Solo el personal con rol
 * 'admin' puede ejecutarla. Acepta el `tenantId` o el `clinicSlug` del slug:
 * si llega un slug, primero se resuelve el `id` real consultando `tenants`
 * por `.eq("slug", clinicSlug)` y el UPDATE se filtra por ese `id` canónico.
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

    // Resolución de la clínica: PRIMERO por slug (clinicSlug) y, solo si el slug
    // no devuelve fila, fallback por id (tenantId).
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

    // Guarda el JSONB unificado: SIEMPRE con `cuentas` (dinámico Admin↔Wizard).
    const datosPago = normalizarDatosPagoMovil(data.datos_pago_movil)
    const maxSlots = normalizarLimite(data.max_slots_per_shift)

    const payloadCompleto: TenantUpdate = {
      nombre,
      rif: data.rif?.trim() || null,
      direccion: data.direccion?.trim() || null,
      telefono: data.telefono?.trim() || null,
      pago_movil_enabled: Boolean(data.pago_movil_enabled),
      max_slots_per_shift: maxSlots,
      datos_pago_movil: datosPago,
      theme_config: normalizarThemeConfig(data.theme_config),
    }

    console.log("[updateTenantSettings] Payload enviado a PostgreSQL:", payloadCompleto)

    const resultadoInicial = await supabase
      .from("tenants")
      .update(payloadCompleto)
      .eq("id", meta.id)
      .select("*")
      .maybeSingle()

    // Tolerancia de esquema: si `theme_config` aún no existe en la BD (migración
    // 0014 sin aplicar), se reintenta sin el tema para no bloquear el guardado.
    let resultado = resultadoInicial
    if (
      resultadoInicial.error &&
      /theme_config|PGRST204|schema cache/i.test(resultadoInicial.error.message ?? "")
    ) {
      console.warn(
        "[updateTenantSettings] Reintentando sin theme_config (columna ausente):",
        resultadoInicial.error.message
      )
      const payloadSinTema = { ...payloadCompleto }
      delete payloadSinTema.theme_config
      resultado = await supabase
        .from("tenants")
        .update(payloadSinTema)
        .eq("id", meta.id)
        .select("*")
        .maybeSingle()
    }

    if (resultado.error) {
      console.error("[updateTenantSettings] ERROR DE SUPABASE AL ACTUALIZAR:", resultado.error)
      return {
        ok: false,
        message: `Error en BD: ${resultado.error.message}`,
      }
    }

    if (!resultado.data) {
      console.error("[updateTenantSettings] UPDATE afectó 0 filas (bloqueo RLS):", {
        slug: meta.slug,
        tenantId: meta.id,
      })
      return {
        ok: false,
        message: "No tienes permisos de administrador para guardar cambios en esta clínica.",
      }
    }

    const tenantActualizado = resultado.data

    console.log("[updateTenantSettings] Guardado exitoso en PostgreSQL:", tenantActualizado)

    // Revalidación completa de rutas
    revalidatePath(`/${meta.slug}/admin/configuracion`, "page")
    revalidatePath(`/${meta.slug}/reservar`, "page")
    revalidatePath(`/${meta.slug}`, "layout")
    revalidatePath("/", "layout")

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
 * Traduce los errores de Supabase Storage a mensajes accionables para la UI.
 */
function mensajeErrorSubida(detalle: string): string {
  const base = "No se pudo subir el logo."
  if (/bucket/i.test(detalle)) {
    return `${base} El almacenamiento 'branding' no está disponible en el servidor. Reintenta en unos minutos o contacta a soporte.`
  }
  if (/policy|row-level|permission|unauthorized|not allowed/i.test(detalle)) {
    return `${base} Tu usuario no tiene permisos para subir archivos en esta clínica.`
  }
  if (/size|too large|exceed/i.test(detalle)) {
    return `${base} La imagen supera el tamaño permitido (3 MB).`
  }
  return `${base} ${detalle}`
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
    // Bucket 'branding': si no existe se crea automáticamente (public: true).
    const bucket = await asegurarBucketPublico(BUCKET_BRANDING)
    if (!bucket.ok) return { ok: false, message: bucket.message }

    // El primer nivel del path es el tenant_id (lo usan las políticas de RLS).
    const path = `${tenantId}/${Date.now()}-logo.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const opcionesSubida = {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    }

    let subida = await supabase.storage
      .from(BUCKET_BRANDING)
      .upload(path, bytes, opcionesSubida)

    // Reintento con service_role: cubre instalaciones sin políticas de Storage.
    if (subida.error) {
      try {
        const admin = createAdminClient()
        subida = await admin.storage
          .from(BUCKET_BRANDING)
          .upload(path, bytes, opcionesSubida)
      } catch {
        // Se conserva el error original para construir el mensaje.
      }
    }

    if (subida.error) {
      return { ok: false, message: mensajeErrorSubida(subida.error.message) }
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_BRANDING)
      .getPublicUrl(path)
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

    revalidatePath(`/${meta.slug}/admin/configuracion`, "page")
    revalidatePath(`/${meta.slug}/reservar`, "page")
    revalidatePath(`/${meta.slug}`, "layout")
    revalidatePath("/", "layout")

    return { ok: true, data: { logoUrl, tenant } }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Error inesperado al subir el logo."
    return { ok: false, message }
  }
}