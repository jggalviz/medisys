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
