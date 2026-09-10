/**
 * MEDISYS · Cron de la tasa BCV.
 *
 * URL: /api/cron/bcv-rate
 * Autenticación: header `Authorization: Bearer <CRON_SECRET>`
 * (CRON_SECRET se configura en Vercel; en Vercel Cron también aplica
 *  protección con el header automático de la plataforma).
 *
 * Obtiene la tasa vigente con la cascada compartida de `@/lib/bcv`
 * (scraping del portal del BCV → APIs alternativas) y hace UPSERT en
 * `bcv_rates` con el cliente `service_role` (bypass de RLS, solo servidor).
 * Así la tasa queda persistida como respaldo para la lectura en cascada.
 */
import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { obtenerTasaBcvEnVivo, TASA_BCV_FALLBACK } from "@/lib/bcv"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const autorizacion = request.headers.get("authorization")
    if (!secret || autorizacion !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
    }

    const resultado = await obtenerTasaBcvEnVivo()
    if (!resultado) {
      return NextResponse.json(
        { ok: false, error: "No se pudo obtener la tasa BCV de ninguna fuente." },
        { status: 502 }
      )
    }

    const fecha = new Date().toISOString().slice(0, 10)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("bcv_rates")
      .upsert(
        {
          fecha,
          tasa: Math.round(resultado.tasa * 100) / 100,
          fuente: resultado.detalle,
        },
        { onConflict: "fecha" }
      )
      .select("id, fecha, tasa, fetched_at, fuente")
      .maybeSingle()

    if (error) {
      console.error("[cron-bcv] Error al insertar en bcv_rates:", error)
      return NextResponse.json(
        { ok: false, error: `Error en BD: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      registro: data ?? null,
      fuente: resultado.fuente,
      detalle: resultado.detalle,
      fallbackUsado: false,
      _fallback: TASA_BCV_FALLBACK,
    })
  } catch (cause) {
    const mensaje = cause instanceof Error ? cause.message : "Error inesperado"
    console.error("[cron-bcv] Error:", mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}
