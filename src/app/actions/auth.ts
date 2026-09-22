"use server"

/**
 * MEDISYS · Server Actions de autenticación del personal.
 *
 *  - `signInStaff`: autentica con Supabase Auth y valida la membresía en
 *    `tenant_users` para el tenant del slug.
 *  - `signOutStaff`: cierra la sesión y redirige al login de la clínica.
 */
import { redirect } from "next/navigation"

import type { TenantUserRole } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { getStaffForSlug } from "@/lib/staff"

export type SignInResult =
  | { ok: true; role: TenantUserRole; tenantId: string }
  | { ok: false; message: string }

export async function signInStaff(input: {
  clinicSlug: string
  email: string
  password: string
}): Promise<SignInResult> {
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!email || !password) {
    return { ok: false, message: "Ingresa tu correo y contraseña." }
  }

  try {
    const supabase = await createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      return { ok: false, message: "Correo o contraseña incorrectos." }
    }

    // Verifica que el usuario autenticado pertenezca a ESTA clínica.
    const staff = await getStaffForSlug(supabase, input.clinicSlug)
    if (!staff) {
      await supabase.auth.signOut()
      return {
        ok: false,
        message: "Tu usuario no tiene acceso al panel de esta clínica.",
      }
    }

    return { ok: true, role: staff.role, tenantId: staff.tenantId }
  } catch {
    return { ok: false, message: "No se pudo iniciar sesión. Intenta de nuevo." }
  }
}

export async function signOutStaff(clinicSlug: string): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${clinicSlug}/login`)
}

/* ------------------------------------------------------------------ */
/* Login global del personal (sin conocer el slug de la clínica)       */
/* ------------------------------------------------------------------ */

export type SignInGlobalResult =
  | { ok: true; slug: string; role: TenantUserRole }
  | { ok: false; message: string }

/**
 * Inicia sesión con correo/contraseña y resuelve a qué clínica entrar a partir
 * de las membresías del usuario en `tenant_users`.
 *
 * Lo usa la pestaña "Iniciar sesión" del registro público (`/registro`), donde
 * el profesional todavía no conoce el enlace de su panel. El login por clínica
 * (`/[clinicSlug]/login`) sigue usando `signInStaff`.
 *
 * Si el usuario pertenece a varias clínicas se prioriza el rol `admin` y, entre
 * ellas, la más antigua activa.
 */
export async function signInStaffGlobal(input: {
  email: string
  password: string
}): Promise<SignInGlobalResult> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.password) {
    return { ok: false, message: "Ingresa tu correo y contraseña." }
  }

  try {
    const supabase = await createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    })
    if (signInError) {
      return { ok: false, message: "Correo o contraseña incorrectos." }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      await supabase.auth.signOut()
      return {
        ok: false,
        message: "No se pudo iniciar sesión. Intenta de nuevo.",
      }
    }

    const { data: membresias, error: errorMembresias } = await supabase
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", user.id)

    if (errorMembresias || !membresias || membresias.length === 0) {
      await supabase.auth.signOut()
      return {
        ok: false,
        message:
          "Tu usuario no tiene una clínica asignada. Crea tu cuenta o escríbenos por WhatsApp.",
      }
    }

    const ids = Array.from(new Set(membresias.map((m) => m.tenant_id)))
    const { data: tenants, error: errorTenants } = await supabase
      .from("tenants")
      .select("id, slug, is_active, created_at")
      .in("id", ids)

    if (errorTenants || !tenants || tenants.length === 0) {
      await supabase.auth.signOut()
      return {
        ok: false,
        message: "No se pudo resolver la clínica de tu usuario. Intenta de nuevo.",
      }
    }

    // Orden: clínicas activas primero, rol admin antes que el resto y, a
    // igualdad de rol, la cuenta más antigua.
    const ORDEN_ROL: Record<string, number> = {
      admin: 0,
      recepcion: 1,
      contador: 2,
      especialista: 3,
      medico: 4,
    }

    const candidatas = tenants
      .map((tenant) => {
        const membresia = membresias.find((m) => m.tenant_id === tenant.id)
        return {
          slug: tenant.slug,
          role: (membresia?.role ?? "especialista") as TenantUserRole,
          activa: tenant.is_active !== false,
          creada: String(tenant.created_at ?? ""),
        }
      })
      .sort(
        (a, b) =>
          Number(b.activa) - Number(a.activa) ||
          (ORDEN_ROL[a.role] ?? 9) - (ORDEN_ROL[b.role] ?? 9) ||
          a.creada.localeCompare(b.creada)
      )

    return { ok: true, slug: candidatas[0].slug, role: candidatas[0].role }
  } catch {
    return { ok: false, message: "No se pudo iniciar sesión. Intenta de nuevo." }
  }
}
