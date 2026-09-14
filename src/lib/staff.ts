/**
 * MEDISYS · Acceso de personal multi-tenant (sesión + membresía).
 *
 * Helper compartido entre:
 *  - `src/middleware.ts` (protección de rutas admin).
 *  - `[clinicSlug]/admin/layout.tsx` (encabezado con email/rol).
 *  - Server Actions de autenticación (`src/app/actions/auth.ts`).
 *
 * Recibe el cliente Supabase ya configurado para el contexto actual
 * (cookies del request en middleware / servidor), de modo que no se depende
 * de una implementación concreta de cookies.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TenantUserRole } from "@/types/database"

export type StaffSession = {
  slug: string
  tenantId: string
  tenantNombre: string
  userId: string
  email: string | null
  role: TenantUserRole
  /**
   * Sedes asignadas al usuario (`tenant_users.sede_ids`).
   * Arreglo vacío = acceso a todas las sedes del tenant.
   */
  sedeIds: string[]
}

type Membresia = { role: TenantUserRole; sedeIds: string[] }

/** Normaliza `sede_ids`: descarta valores no textuales y duplicados. */
function normalizarSedeIds(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const ids = valor.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )
  return Array.from(new Set(ids))
}

/**
 * Lee la membresía del usuario en el tenant.
 *
 * Tolerante a instalaciones sin la migración 0016: si la columna `sede_ids`
 * aún no existe (error de PostgREST), reintenta consultando solo `role` para
 * no bloquear el acceso al panel.
 */
async function leerMembresia(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<Membresia | null> {
  const conSedes = await supabase
    .from("tenant_users")
    .select("role, sede_ids")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!conSedes.error) {
    const fila = conSedes.data as
      | { role: TenantUserRole; sede_ids?: unknown }
      | null
        | undefined
    return fila
      ? { role: fila.role, sedeIds: normalizarSedeIds(fila.sede_ids) }
      : null
  }

  const simple = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (simple.error || !simple.data) return null
  return { role: simple.data.role, sedeIds: [] }
}

/**
 * Devuelve la sesión del staff que pertenece al tenant del slug, o `null`
 * si no hay sesión, el slug no corresponde a una clínica activa, o el
 * usuario no está registrado en `tenant_users`.
 */
export async function getStaffForSlug(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<StaffSession | null> {
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, nombre")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()

    if (tenantError || !tenant) return null

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return null

    const membresia = await leerMembresia(supabase, tenant.id, user.id)
    if (!membresia) return null

    return {
      slug: tenant.slug,
      tenantId: tenant.id,
      tenantNombre: tenant.nombre,
      userId: user.id,
      email: user.email ?? null,
      role: membresia.role,
      sedeIds: membresia.sedeIds,
    }
  } catch {
    // Fallo de red/RLS → no autorizado (nunca romper el render).
    return null
  }
}

/**
 * Igual que `getStaffForSlug` pero resolviendo la clínica por su UUID.
 * Lo usan las API del módulo de administración (`/api/admin/*`), que pueden
 * recibir `tenantId` en lugar de `clinicSlug`.
 */
export async function getStaffForTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<StaffSession | null> {
  if (!tenantId?.trim()) return null

  try {
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, nombre")
      .eq("id", tenantId.trim())
      .maybeSingle()

    if (tenantError || !tenant) return null

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return null

    const membresia = await leerMembresia(supabase, tenant.id, user.id)
    if (!membresia) return null

    return {
      slug: tenant.slug,
      tenantId: tenant.id,
      tenantNombre: tenant.nombre,
      userId: user.id,
      email: user.email ?? null,
      role: membresia.role,
      sedeIds: membresia.sedeIds,
    }
  } catch {
    return null
  }
}
