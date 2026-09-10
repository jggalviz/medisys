/**
 * MEDISYS · Utilidades de Supabase Storage (solo servidor).
 *
 * Centraliza la preparación de buckets públicos: si un bucket requerido por
 * la plataforma no existe (p. ej. 'branding'), se crea automáticamente con el
 * cliente `service_role` para que el flujo de subida nunca falle por 404.
 */
import { createAdminClient } from "@/lib/supabase/admin"

/** Buckets usados por la plataforma. */
export const BUCKET_BRANDING = "branding"
export const BUCKET_COMPROBANTES = "comprobantes"

export type AsegurarBucketResult =
  | { ok: true; creado: boolean }
  | { ok: false; message: string }

/**
 * Garantiza que un bucket PÚBLICO exista. Idempotente: si ya existe (o la
 * creación responde "already exists") devuelve `ok`.
 */
export async function asegurarBucketPublico(
  nombre: string
): Promise<AsegurarBucketResult> {
  try {
    const admin = createAdminClient()

    // 1) ¿Existe ya?
    const { data: bucket, error: getError } = await admin.storage.getBucket(nombre)
    if (bucket && !getError) return { ok: true, creado: false }

    // 2) Intentar crearlo como público.
    const { error: createError } = await admin.storage.createBucket(nombre, {
      public: true,
    })
    if (!createError) return { ok: true, creado: true }

    const mensaje = String(createError.message ?? "")
    if (/already exists|duplicate/i.test(mensaje)) {
      return { ok: true, creado: false }
    }

    return {
      ok: false,
      message: `No se pudo preparar el almacenamiento '${nombre}': ${
        mensaje || getError?.message || "error desconocido"
      }`,
    }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error
          ? `No se pudo acceder al almacenamiento: ${cause.message}`
          : "No se pudo acceder al almacenamiento del servidor.",
    }
  }
}
