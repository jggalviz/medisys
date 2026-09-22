"use server"

/**
 * MEDISYS · Cierre de sesión desde el header público.
 *
 * Sirve para los tres tipos de sesión del producto:
 *  - Supabase Auth (personal de clínica y Super Admin),
 *  - portal ligero (`portal_session`: especialista / paciente).
 *
 * Se usa como `action` de un formulario, así que funciona incluso sin
 * JavaScript, y siempre regresa a la landing.
 */
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { clearPortalCookie } from "@/lib/portal-session"

/** Cierra la sesión que esté activa y vuelve a la landing. */
export async function cerrarSesion(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Sin sesión de Supabase (p. ej. solo portal): se ignora.
  }

  try {
    await clearPortalCookie()
  } catch {
    // Fuera de un contexto con cookies escribibles: se ignora.
  }

  redirect("/")
}
