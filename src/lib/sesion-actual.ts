/**
 * MEDISYS · Sesión activa para el header público (server only).
 * ---------------------------------------------------------------
 * Resuelve, en una sola llamada, quién está navegando la landing:
 *
 *   1. **Super Admin**  → cookie de Supabase Auth + `user_metadata.role`.
 *   2. **Staff**        → cookie de Supabase Auth + membresía en `tenant_users`
 *                         (clínica por defecto según `getStaffSessionGlobal`).
 *   3. **Portal**       → cookie firmada `portal_session` (especialista o
 *                         paciente del portal ligero, sin contraseña).
 *   4. **Invitado**     → `null`.
 *
 * Camino rápido: si la petición no trae cookies de sesión se responde sin tocar
 * Supabase (la mayoría de las visitas de la landing son anónimas).
 *
 * Nunca lanza: ante cualquier fallo (red, RLS, cookie corrupta) devuelve `null`
 * y el header se dibuja como invitado.
 */
import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { getPortalSession, PORTAL_COOKIE } from "@/lib/portal-session"
import { getStaffSessionGlobal } from "@/lib/staff"
import {
  sesionPortal,
  sesionStaff,
  sesionSuperAdmin,
  type SesionHeader,
} from "@/lib/destinos-sesion"

/** ¿Alguna cookie tiene pinta de sesión de Supabase Auth (`sb-*-auth-token`)? */
function hayCookieSupabase(nombres: string[]): boolean {
  return nombres.some(
    (nombre) => nombre.startsWith("sb-") && nombre.includes("auth-token")
  )
}

/** Nombre de pila guardado en `user_metadata` (registro o alta del staff). */
function nombreDeMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  if (typeof metadata.nombre === "string" && metadata.nombre.trim()) {
    return metadata.nombre.trim()
  }
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
    return metadata.full_name.trim()
  }
  return null
}

/**
 * Devuelve la sesión lista para el header, o `null` si el visitante es
 * anónimo.
 */
export async function getSesionHeader(): Promise<SesionHeader | null> {
  try {
    const store = await cookies()
    const nombres = store.getAll().map((cookie) => cookie.name)
    const tieneSupabase = hayCookieSupabase(nombres)
    const tienePortal = nombres.includes(PORTAL_COOKIE)

    if (!tieneSupabase && !tienePortal) return null

    // 1 y 2 · Sesión de Supabase Auth (super admin o personal de clínica).
    if (tieneSupabase) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const metadata = user.user_metadata as
          | Record<string, unknown>
          | undefined
        const nombre = nombreDeMetadata(metadata)

        if (metadata?.role === "super_admin") {
          return sesionSuperAdmin({ nombre, email: user.email ?? null })
        }

        const staff = await getStaffSessionGlobal(supabase)
        if (staff) {
          return sesionStaff({
            nombre,
            email: staff.email,
            rol: staff.role,
            clinicSlug: staff.tenantSlug,
            clinicNombre: staff.tenantNombre,
          })
        }
      }
    }

    // 3 · Sesión ligera de portal (especialista / paciente).
    if (tienePortal) {
      const portal = await getPortalSession()
      if (portal) {
        const supabase = await createClient()
        const { data: tenant } = await supabase
          .from("tenants")
          .select("slug, nombre")
          .eq("id", portal.tenant_id)
          .maybeSingle()

        if (tenant) {
          return sesionPortal({
            rol: portal.rol,
            nombre: portal.nombre,
            clinicSlug: tenant.slug,
            clinicNombre: tenant.nombre,
          })
        }
      }
    }

    return null
  } catch {
    // Sin sesión verificable: el header se dibuja como invitado.
    return null
  }
}
