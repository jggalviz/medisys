/**
 * MEDISYS · Sesión y permisos del módulo de administración
 * -----------------------------------------------------------------
 * Resuelve el contexto de un Route Handler o Server Action:
 *   1. Cliente Supabase con la sesión de la petición (cookies).
 *   2. Membresía del usuario en la clínica (`clinicSlug` o `tenantId`).
 *   3. Permiso RBAC requerido por la operación.
 *
 * Devuelve siempre un resultado discriminado para que la API traduzca el
 * código a un estado HTTP coherente (`responder`).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import type { AdminModuleErrorCode, AdminModuleResult } from "@/types/admin"
import type { Database } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug, getStaffForTenant, type StaffSession } from "@/lib/staff"
import { tienePermiso, type PermisoAdmin } from "@/lib/rbac"
import { esUuid } from "@/lib/fiscal-ve"

export type ContextoAdmin = {
  supabase: SupabaseClient<Database>
  staff: StaffSession
}

export type IdentificadorClinica = {
  clinicSlug: string | null
  tenantId: string | null
}

/** Normaliza los identificadores recibidos por query string o cuerpo JSON. */
export function leerIdentificadorClinica(
  fuente: Record<string, unknown>
): IdentificadorClinica {
  const texto = (valor: unknown): string | null => {
    if (typeof valor !== "string") return null
    const limpio = valor.trim()
    return limpio.length > 0 ? limpio : null
  }
  const clinicSlug = texto(fuente.clinicSlug) ?? texto(fuente.slug)
  const tenantIdBruto = texto(fuente.tenantId)
  return {
    clinicSlug,
    tenantId: tenantIdBruto && esUuid(tenantIdBruto) ? tenantIdBruto : null,
  }
}

/**
 * Resuelve el contexto administrativo de la petición actual.
 *
 * @param entrada.clinicSlug slug de la clínica (preferido).
 * @param entrada.tenantId   UUID alternativo cuando no hay slug.
 * @param entrada.permiso    permiso RBAC exigido (opcional, lectura libre).
 */
export async function resolverContextoAdmin(entrada: {
  clinicSlug?: string | null
  tenantId?: string | null
  permiso?: PermisoAdmin
}): Promise<AdminModuleResult<ContextoAdmin>> {
  const { clinicSlug, tenantId, permiso } = entrada

  if (!clinicSlug && !tenantId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message:
        "Debes indicar la clínica con `clinicSlug` (o `tenantId`) en la petición.",
    }
  }

  const supabase = await createClient()
  const staff = clinicSlug
    ? await getStaffForSlug(supabase, clinicSlug)
    : await getStaffForTenant(supabase, tenantId as string)

  if (!staff) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message:
        "No autorizado: inicia sesión como personal de la clínica para continuar.",
    }
  }

  if (permiso && !tienePermiso(staff.role, permiso)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `Tu rol (${staff.role}) no tiene permiso para esta operación.`,
    }
  }

  return { ok: true, data: { supabase, staff } }
}

/** Traduce el código del resultado al estado HTTP correspondiente. */
export function estadoHttpDeCodigo(code: AdminModuleErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "CONFLICT":
      return 409
    case "INVALID_INPUT":
      return 422
    case "MIGRACION_PENDIENTE":
      return 503
    default:
      return 500
  }
}

/** Respuesta JSON uniforme de las API del módulo (`{ ok, data | code }`). */
export function responder<T>(
  resultado: AdminModuleResult<T>,
  estadoExito = 200
): NextResponse {
  if (resultado.ok) {
    return NextResponse.json(
      { ok: true, data: resultado.data },
      { status: estadoExito }
    )
  }
  return NextResponse.json(
    {
      ok: false,
      code: resultado.code,
      message: resultado.message,
      issues: resultado.issues ?? [],
    },
    { status: estadoHttpDeCodigo(resultado.code) }
  )
}

/** Lee y valida el cuerpo JSON de una petición (nunca lanza). */
export async function leerCuerpoJson(
  request: Request
): Promise<Record<string, unknown>> {
  try {
    const cuerpo: unknown = await request.json()
    return cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo)
      ? (cuerpo as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** Identificadores de la clínica a partir de query string (GET/DELETE). */
export function identificadorDesdeUrl(url: string): IdentificadorClinica {
  const { searchParams } = new URL(url)
  return leerIdentificadorClinica({
    clinicSlug: searchParams.get("clinicSlug") ?? searchParams.get("slug"),
    tenantId: searchParams.get("tenantId"),
  })
}
