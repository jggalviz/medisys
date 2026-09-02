"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/database"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Cliente Supabase para el navegador (sesión en cookies, igual que el
 * servidor). Se usa únicamente para subir el comprobante de pago a
 * Storage desde `StepPayment`.
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno."
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
