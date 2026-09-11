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
    const tasaRedondeada = Math.round(resultado.tasa * 100) / 100

    // El esquema remoto de `bcv_rates` puede variar (p. ej. solo `rate` +
    // `fetched_at`, o `fecha`/`tasa`/`fuente`). Se intenta primero el esquema
    // completo y, si falla por columnas ausentes, se cae al mínimo viable.
    let data: Record<string, unknown> | null = null
    let error: { message: string } | null = null

    const intentos: Record<string, unknown>[] = [
      { fecha, tasa: tasaRedondeada, fuente: resultado.detalle },
      {
        rate: tasaRedondeada,
        fetched_at: new Date().toISOString(),
        fuente: resultado.detalle,
      },
      { rate: tasaRedondeada, fetched_at: new Date().toISOString() },
      { tasa: tasaRedondeada, fetched_at: new Date().toISOString() },
    ]

    // El tipado del cliente asume el esquema local; aquí se insertan payloads
    // tolerantes al esquema real, por lo que se usa una vista tipada mínima.
    type InserterBcv = {
      insert: (values: Record<string, unknown>) => {
        select: (columns?: string) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null
            error: { message: string } | null
          }>
        }
      }
    }
    const tabla = supabase.from("bcv_rates") as unknown as InserterBcv

    for (const payload of intentos) {
      const respuesta = await tabla.insert(payload).select("*").maybeSingle()
      if (!respuesta.error) {
        data = respuesta.data
        error = null
        break
      }
      error = respuesta.error
    }

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
