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

/**
 * Sesión de staff resuelta sin conocer el slug del consultorio
 * (ver `getStaffSessionGlobal`).
 */
export type StaffSessionGlobal = {
  userId: string
  email: string | null
  role: TenantUserRole
  tenantId: string
  tenantSlug: string
  tenantNombre: string
}

/** Prioridad de roles al elegir la clínica "por defecto" de un usuario. */
const ORDEN_ROL_DEFECTO: Record<string, number> = {
  admin: 0,
  recepcion: 1,
  contador: 2,
  especialista: 3,
  medico: 4,
}

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

/**
 * Sesión de staff resuelta SIN conocer el slug: busca las membresías del
 * usuario autenticado y elige la clínica "por defecto".
 *
 * Criterio de elección (idéntico al del login global `signInStaffGlobal`):
 *   1. clínicas activas antes que inactivas,
 *   2. rol `admin` antes que el resto,
 *   3. la cuenta más antigua.
 *
 * Lo usan el login global (`/registro?modo=login`) y el header de la landing
 * (`getSesionHeader`), que necesita saber a qué panel enviar al usuario sin
 * pedirle el slug del consultorio.
 */
export async function getStaffSessionGlobal(
  supabase: SupabaseClient<Database>
): Promise<StaffSessionGlobal | null> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return null

    const { data: membresias, error: errorMembresias } = await supabase
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", user.id)
    if (errorMembresias || !membresias || membresias.length === 0) return null

    const ids = Array.from(new Set(membresias.map((m) => m.tenant_id)))
    const { data: tenants, error: errorTenants } = await supabase
      .from("tenants")
      .select("id, slug, nombre, is_active, created_at")
      .in("id", ids)
    if (errorTenants || !tenants || tenants.length === 0) return null

    const candidatas = tenants
      .map((tenant) => {
        const membresia = membresias.find((m) => m.tenant_id === tenant.id)
        return {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantNombre: tenant.nombre,
          role: (membresia?.role ?? "especialista") as TenantUserRole,
          activa: tenant.is_active !== false,
          creada: String(tenant.created_at ?? ""),
        }
      })
      .sort(
        (a, b) =>
          Number(b.activa) - Number(a.activa) ||
          (ORDEN_ROL_DEFECTO[a.role] ?? 9) - (ORDEN_ROL_DEFECTO[b.role] ?? 9) ||
          a.creada.localeCompare(b.creada)
      )

    const elegida = candidatas[0]
    return {
      userId: user.id,
      email: user.email ?? null,
      role: elegida.role,
      tenantId: elegida.tenantId,
      tenantSlug: elegida.tenantSlug,
      tenantNombre: elegida.tenantNombre,
    }
  } catch {
    // Fallo de red/RLS → sin sesión de staff (nunca romper el render).
    return null
  }
}

