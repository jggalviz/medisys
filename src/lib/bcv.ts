/**
 * MEDISYS · Tasa oficial BCV.
 *
 * `getLatestBcvRate` lee la fila más reciente de `bcv_rates` (ordenada por
 * `fetched_at desc`). Si la tabla no tiene filas, no está migrada o falla la
 * consulta, devuelve el valor de respaldo `TASA_BCV_FALLBACK` (36,50 Bs/USD).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/** Tasa de respaldo mientras no exista una fila en `bcv_rates`. */
export const TASA_BCV_FALLBACK = 36.5

type Client = Pick<SupabaseClient<Database>, "from">

/** Convierte un precio USD a Bolívares usando la tasa recibida. */
export function convertirADolares(usd: number, tasaBCV: number): number {
  return usd * tasaBCV
}

/** Lee la última tasa BCV publicada (o el fallback). Nunca lanza. */
export async function getLatestBcvRate(supabase: Client): Promise<number> {
  try {
    const { data } = await supabase
      .from("bcv_rates")
      .select("tasa")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const tasa = Number(data?.tasa)
    return Number.isFinite(tasa) && tasa > 0 ? tasa : TASA_BCV_FALLBACK
  } catch {
    return TASA_BCV_FALLBACK
  }
}
