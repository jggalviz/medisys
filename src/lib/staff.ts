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

    const { data: member, error: memberError } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !member) return null

    return {
      slug: tenant.slug,
      tenantId: tenant.id,
      tenantNombre: tenant.nombre,
      userId: user.id,
      email: user.email ?? null,
      role: member.role,
    }
  } catch {
    // Fallo de red/RLS → no autorizado (nunca romper el render).
    return null
  }
}
