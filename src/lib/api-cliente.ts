/**
 * MEDISYS · Cliente HTTP de las API del panel (seguro en cliente)
 * -----------------------------------------------------------------
 * Utilidades compartidas por los wrappers de cada módulo
 * (`api-admin.ts`, `api-facturacion.ts`):
 *   - `RespuestaApi<T>`: contrato uniforme de las API `/api/admin/*`.
 *   - `pedir()`: `fetch` con JSON, sin caché y con errores normalizados.
 *   - `consulta()`: construye el query string con `clinicSlug`.
 *
 * No importa nada de Supabase: los datos viajan por HTTP con la sesión del
 * navegador (cookies), así el panel nunca toca credenciales de servicio.
 */
import type { AdminModuleErrorCode, CampoIssue } from "@/types/admin"

/** Respuesta normalizada de las API del panel. */
export type RespuestaApi<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: AdminModuleErrorCode
      message: string
      issues?: CampoIssue[]
    }

/** `fetch` JSON con errores normalizados (nunca lanza). */
export async function pedir<T>(
  url: string,
  init?: RequestInit
): Promise<RespuestaApi<T>> {
  try {
    const respuesta = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })

    const cuerpo = (await respuesta.json().catch(() => null)) as
      | RespuestaApi<T>
      | null

    if (!cuerpo) {
      return {
        ok: false,
        code: "SERVER_ERROR",
        message: `El servidor respondió ${respuesta.status} sin datos legibles.`,
      }
    }

    return cuerpo
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "No se pudo contactar al servidor. Revisa tu conexión.",
    }
  }
}

/** Query string con `clinicSlug` + parámetros extra. */
export function consulta(
  clinicSlug: string,
  extra: Record<string, string> = {}
): string {
  return new URLSearchParams({ clinicSlug, ...extra }).toString()
}
