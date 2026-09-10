"use server"

/**
 * MEDISYS · Landing Page del tenant (Server Actions).
 *
 * `updateTenantLandingConfig` guarda `landing_enabled` y `landing_config` en la
 * tabla `tenants`. Solo el rol 'admin' del tenant puede modificarla.
 */
import { revalidatePath } from "next/cache"

import type { LandingConfig } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { limpiarLandingConfig } from "@/lib/landing"

export type LandingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type UpdateLandingInput = {
  tenantId?: string | null
  clinicSlug?: string | null
  enabled: boolean
  config: LandingConfig
}

export type LandingConfigOutput = {
  tenantId: string
  slug: string
  landing_enabled: boolean
  landing_config: LandingConfig
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/** Resuelve la clínica por id o slug (el id nunca se confía desde la URL). */
async function resolverTenant(
  supabase: SupabaseClient,
  input: { tenantId?: string | null; clinicSlug?: string | null }
): Promise<{ ok: true; id: string; slug: string } | { ok: false; message: string }> {
  const tenantId = input.tenantId?.trim()
  const slug = input.clinicSlug?.trim()

  if (tenantId) {
    const { data } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("id", tenantId)
      .maybeSingle()
    if (!data) return { ok: false, message: "Clínica no encontrada." }
    return { ok: true, id: data.id, slug: data.slug }
  }

  if (!slug) return { ok: false, message: "Falta la clínica." }

  const { data } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle()
  if (!data) return { ok: false, message: "Clínica no encontrada." }
  return { ok: true, id: data.id, slug: data.slug }
}

/** Exige sesión con rol 'admin' en el tenant. */
async function autorizarAdmin(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, message: "No autorizado: inicia sesión." }

  const { data: member } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!member || member.role !== "admin") {
    return { ok: false, message: "Solo el administrador puede editar la landing." }
  }
  return { ok: true }
}

/** Guarda el switch y el contenido de la Landing Page. */
export async function updateTenantLandingConfig(
  input: UpdateLandingInput
): Promise<LandingResult<LandingConfigOutput>> {
  try {
    const supabase = await createClient()
    const tenant = await resolverTenant(supabase, input)
    if (!tenant.ok) return tenant

    const acceso = await autorizarAdmin(supabase, tenant.id)
    if (!acceso.ok) return acceso

    const config = limpiarLandingConfig(input.config)

    const { data, error } = await supabase
      .from("tenants")
      .update({ landing_enabled: Boolean(input.enabled), landing_config: config })
      .eq("id", tenant.id)
      .select("id, slug, landing_enabled, landing_config")
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    if (!data) {
      return { ok: false, message: "No se pudo guardar la landing. Intenta de nuevo." }
    }

    revalidatePath(`/${tenant.slug}`)
    revalidatePath(`/${tenant.slug}/admin/landing`)

    return {
      ok: true,
      data: {
        tenantId: data.id,
        slug: data.slug,
        landing_enabled: data.landing_enabled !== false,
        landing_config: limpiarLandingConfig(data.landing_config),
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al guardar la landing.",
    }
  }
}
