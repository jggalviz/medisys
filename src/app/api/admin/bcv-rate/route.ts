/**
 * MEDISYS · API del módulo de administración · Tasa oficial BCV
 * ==============================================================
 * `GET  /api/admin/bcv-rate?clinicSlug=...`
 *   Tasa vigente (con su origen: manual · BCV · respaldo) + historial.
 *
 * `POST /api/admin/bcv-rate`
 *   - `{ modo: "manual", tasa: { rate, currency?, effectiveDate?, autoUpdate? } }`
 *     → sobreescritura manual del administrador (`source = MANUAL`).
 *   - `{ modo: "auto" }` → fuerza la consulta al BCV y persiste la del día.
 *
 * La cascada de respaldo (`auto → BCV web → APIs → BD → hardcodeado`) vive en
 * `@/lib/currency-rates` + `@/lib/bcv`, de modo que la UI y el cron comparten
 * exactamente la misma lógica.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import {
  getTasaVigente,
  historialTasas,
  refrescarTasaBcv,
  registrarTasaManual,
} from "@/lib/currency-rates"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import type { CurrencyCode } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function leerMoneda(valor: unknown): CurrencyCode {
  return valor === "VES" ? "VES" : "USD"
}

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "tasa:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase } = contexto.data
  const { searchParams } = new URL(request.url)
  const currency = leerMoneda(searchParams.get("currency"))

  const [tasa, historial] = await Promise.all([
    getTasaVigente(supabase, { currency }),
    historialTasas(supabase, { currency, limite: 10 }),
  ])

  return NextResponse.json({ ok: true, data: { tasa, historial } })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "tasa:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const modo = cuerpo.modo === "auto" ? "auto" : "manual"
  const currency = leerMoneda(
    (cuerpo.tasa as Record<string, unknown> | undefined)?.currency ??
      cuerpo.currency
  )

  if (modo === "auto") {
    const refresco = await refrescarTasaBcv(supabase, { currency })
    if (!refresco.ok) return responder(refresco)
    revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
    return responder(refresco)
  }

  const manual = await registrarTasaManual(
    supabase,
    cuerpo.tasa ?? cuerpo,
    { createdBy: staff.userId }
  )
  if (!manual.ok) return responder(manual)

  // Se responde con la tasa vigente ya normalizada (orig. "manual").
  const vigente = await getTasaVigente(supabase, { currency })
  revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
  return responder({ ok: true, data: vigente }, 201)
}
