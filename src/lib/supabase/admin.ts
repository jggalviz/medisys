/**
 * MEDISYS · Cliente Supabase con rol `service_role`.
 *
 * Solo debe usarse desde Server Actions/Route Handlers de confianza (p. ej.
 * el cron de la tasa BCV). NUNCA se importa desde componentes cliente.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para el cliente administrativo."
    )
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
