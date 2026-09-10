/**
 * MEDISYS · Guard de Super Admin (server only).
 * El rol se lee de `user.user_metadata.role === 'super_admin'`.
 */
import { createClient } from "@/lib/supabase/server"

export type SuperAdminSession = {
  userId: string
  email: string | null
}

export async function getSuperAdmin(): Promise<SuperAdminSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  if (metadata?.role !== "super_admin") return null

  return { userId: user.id, email: user.email ?? null }
}

export function isSuperAdminRoute(pathname: string): boolean {
  return pathname === "/super-admin" || pathname.startsWith("/super-admin/")
}
