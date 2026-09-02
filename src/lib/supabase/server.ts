import { cache } from "react"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Crea un cliente Supabase del lado servidor enlazado a las cookies de la
 * petición. `cache()` garantiza una sola instancia por render/request.
 *
 * Nota Next.js 16: `cookies()` es asíncrono; `setAll` envuelve la escritura
 * en try/catch porque en Server Components no está permitido modificar
 * cookies (el refresco de sesión lo maneja middleware/Route Handler).
 */
export const createClient = cache(async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno."
    )
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Llamado desde un Server Component. El middleware debe refrescar la sesión.
        }
      },
    },
  })
})
