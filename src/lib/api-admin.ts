/**
 * MEDISYS · Cliente HTTP del módulo de administración (seguro en cliente)
 * ======================================================================
 * Envuelve las API `/api/admin/*` con tipos y manejo de errores uniforme para
 * que los componentes cliente no dupliquen `fetch` + parseo + mensajes.
 *
 * No importa nada de Supabase: los datos viajan por HTTP con la sesión del
 * navegador (cookies), así el panel nunca toca credenciales de servicio.
 */
import type {
  AdminModuleErrorCode,
  CampoIssue,
  EntidadFiscal,
  SedeDTO,
  ServicioMedicoDTO,
  TasaBcv,
  TasaRegistro,
} from "@/types/admin"
import type {
  EntidadFiscalInput,
  ServicioMedicoInput,
  SedeInput,
  TasaBcvInput,
} from "@/lib/validations/admin"

/** Respuesta normalizada de las API del módulo. */
export type RespuestaApi<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: AdminModuleErrorCode
      message: string
      issues?: CampoIssue[]
    }

export type AjustesAdministracion = {
  clinic: {
    tenantId: string
    clinicSlug: string
    nombre: string
    role: string
    sedeIds: string[]
    permisos: string[]
  }
  fiscal: EntidadFiscal
  sedes: SedeDTO[]
  /** Aviso cuando la migración 0016 aún no está aplicada (sedes vacías). */
  sedesAviso: string | null
  tasa: TasaBcv
}

const BASE = "/api/admin"

async function pedir<T>(url: string, init?: RequestInit): Promise<RespuestaApi<T>> {
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

function consulta(clinicSlug: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ clinicSlug, ...extra })
  return params.toString()
}

/* ----------------------------- Ajustes ----------------------------- */

export function apiObtenerAjustes(clinicSlug: string) {
  return pedir<AjustesAdministracion>(`${BASE}/settings?${consulta(clinicSlug)}`)
}

export function apiGuardarEntidadFiscal(
  clinicSlug: string,
  fiscal: EntidadFiscalInput
) {
  return pedir<EntidadFiscal>(`${BASE}/settings`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, fiscal }),
  })
}

/* ---------------------------- Tasa BCV ----------------------------- */

export function apiObtenerTasaBcv(
  clinicSlug: string,
  currency: "USD" | "VES" = "USD"
) {
  return pedir<{ tasa: TasaBcv; historial: TasaRegistro[] }>(
    `${BASE}/bcv-rate?${consulta(clinicSlug, { currency })}`
  )
}

/** Sobreescritura manual de la tasa (override del administrador). */
export function apiRegistrarTasaManual(
  clinicSlug: string,
  tasa: TasaBcvInput
) {
  return pedir<TasaBcv>(`${BASE}/bcv-rate`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, modo: "manual", tasa }),
  })
}

/** Fuerza la consulta al BCV y persiste la tasa oficial del día. */
export function apiRefrescarTasaBcv(clinicSlug: string) {
  return pedir<TasaBcv>(`${BASE}/bcv-rate`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, modo: "auto" }),
  })
}

/* --------------------------- Servicios ----------------------------- */

export function apiListarServicios(clinicSlug: string) {
  return pedir<{ servicios: ServicioMedicoDTO[]; total: number }>(
    `${BASE}/services?${consulta(clinicSlug)}`
  )
}

export function apiCrearServicio(
  clinicSlug: string,
  servicio: ServicioMedicoInput
) {
  return pedir<ServicioMedicoDTO>(`${BASE}/services`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, servicio }),
  })
}

export function apiActualizarServicio(
  clinicSlug: string,
  id: string,
  servicio: ServicioMedicoInput
) {
  return pedir<ServicioMedicoDTO>(`${BASE}/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, servicio }),
  })
}

export function apiAlternarServicio(
  clinicSlug: string,
  id: string,
  activo: boolean
) {
  return pedir<ServicioMedicoDTO>(`${BASE}/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, accion: "alternar", activo }),
  })
}

export function apiEliminarServicio(clinicSlug: string, id: string) {
  return pedir<{ id: string }>(
    `${BASE}/services/${id}?${consulta(clinicSlug)}`,
    { method: "DELETE" }
  )
}

/* ----------------------------- Sedes ------------------------------- */

export function apiListarSedes(clinicSlug: string) {
  return pedir<{ sedes: SedeDTO[]; total: number }>(
    `${BASE}/sedes?${consulta(clinicSlug)}`
  )
}

export function apiCrearSede(clinicSlug: string, sede: SedeInput) {
  return pedir<SedeDTO>(`${BASE}/sedes`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, sede }),
  })
}

export function apiActualizarSede(
  clinicSlug: string,
  id: string,
  sede: SedeInput
) {
  return pedir<SedeDTO>(`${BASE}/sedes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, sede }),
  })
}

export function apiAlternarSede(clinicSlug: string, id: string, activo: boolean) {
  return pedir<SedeDTO>(`${BASE}/sedes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, accion: "alternar", activo }),
  })
}

export function apiEliminarSede(clinicSlug: string, id: string) {
  return pedir<{ id: string }>(`${BASE}/sedes/${id}?${consulta(clinicSlug)}`, {
    method: "DELETE",
  })
}
