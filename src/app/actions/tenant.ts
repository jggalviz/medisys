"use server"

/**
 * MEDISYS · Contexto de tenant para las rutas dinámicas por `[clinicSlug]`.
 *
 * Todas las páginas de reserva y administración resuelven aquí la clínica
 * activa y pasan su `id` a las Server Actions correspondientes, sin depender
 * de query params como `?tenantId=`.
 */
import type { Tenant } from "@/types/database"
import { createClient } from "@/lib/supabase/server"

/**
 * Busca el tenant activo por su slug.
 * Devuelve `null` si no existe o si `is_active` es false (→ la página debe
 * renderizar notFound()).
 */
export async function getTenantBySlug(
  slug: string
): Promise<Tenant | null> {
  if (!slug?.trim()) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle()

  if (error) return null
  return data ?? null
}
