import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/types/database"
import { getStaffForSlug } from "@/lib/staff"

/**
 * MEDISYS · Proxy de protección de rutas (Next.js 16 renombró Middleware a
 * Proxy; API idéntica).
 *
 * Protege:
 *   /[clinicSlug]/admin/*   → exige sesión + membresía en `tenant_users`.
 *   /[clinicSlug]/login     → si ya hay sesión válida, redirige al panel.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split("/").filter(Boolean)
  const clinicSlug = segments[0] ? decodeURIComponent(segments[0]) : ""

  const isAdminRoute = segments[1] === "admin"
  const isLoginRoute = segments[1] === "login"
  const isSuperAdminRoute = segments[0] === "super-admin"

  if (!isAdminRoute && !isLoginRoute && !isSuperAdminRoute) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sin configuración: no se puede verificar acceso → a login en rutas admin.
    return isAdminRoute
      ? NextResponse.redirect(new URL(`/${clinicSlug}/login`, request.url))
      : NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // Super Admin: exige `user.user_metadata.role === 'super_admin'`.
  if (isSuperAdminRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const metadata = user?.user_metadata as Record<string, unknown> | undefined
    if (metadata?.role !== "super_admin") {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // Verifica sesión + membresía en el tenant (devuelve null ante cualquier error).
  const staff = await getStaffForSlug(supabase, clinicSlug)

  if (isLoginRoute) {
    if (staff) {
      return NextResponse.redirect(new URL(`/${clinicSlug}/admin`, request.url))
    }
    return response
  }

  // Ruta administrativa sin sesión válida → login con retorno opcional.
  if (!staff) {
    const loginUrl = new URL(`/${clinicSlug}/login`, request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/:clinicSlug/admin/:path*",
    "/:clinicSlug/login",
    "/super-admin/:path*",
  ],
}
