/**
 * MEDISYS · Cron diario de la tasa BCV.
 *
 * URL: /api/cron/bcv-rate
 * Autenticación: header `Authorization: Bearer <CRON_SECRET>`
 * (CRON_SECRET se configura en Vercel; en Vercel Cron también aplica
 *  protección con el header automático de la plataforma).
 *
 * Extrae la tasa oficial de fuentes públicas y hace UPSERT en `bcv_rates`
 * usando el cliente `service_role` (bypass de RLS, solo servidor).
 */
import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { TASA_BCV_FALLBACK } from "@/lib/bcv"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const FUENTES_TASA: { nombre: string; url: string }[] = [
  // API pública con la tasa oficial BCV publicada (JSON estable).
  { nombre: "dolarapi.com (BCV oficial)", url: "https://dolarapi.com/v1/dolares/oficial" },
  // Página oficial del BCV (fallback parseando el HTML).
  { nombre: "bcv.org.ve", url: "https://www.bcv.org.ve/tasas-informativas-sistema-bancario" },
]

/** Normaliza "36,50" / "36.50" a número. */
function parsearNumero(valor: unknown): number | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null
  const numero = Number(String(valor).replace(/,/g, ".").replace(/[^\d.]/g, ""))
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

/** Parsea la página oficial del BCV buscando la fila del "Dólar". */
function parsearHTMLBCV(html: string): number | null {
  const bloque = html.slice(html.toLowerCase().indexOf("dólar"))
  const match = bloque.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/)
  if (!match) return null
  const tasa = parsearNumero(match[1])
  if (!tasa) return null
  // El HTML puede incluir también el Euro; el primer bloque tras "Dólar"
  // es la tasa del dólar oficial en Bs.
  return Math.round(tasa * 100) / 100
}

async function obtenerTasaBCV(): Promise<{
  tasa: number
  fecha: string | null
  fuente: string
} | null> {
  for (const fuente of FUENTES_TASA) {
    try {
      const respuesta = await fetch(fuente.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Medisys-Cron/1.0 (+https://medisys.com.ve)" },
      })
      if (!respuesta.ok) continue

      const contentType = respuesta.headers.get("content-type") ?? ""
      if (contentType.includes("json")) {
        const json = (await respuesta.json()) as {
          transferencia?: unknown
          compra?: unknown
          venta?: unknown
          fecha?: string
        }
        const tasa =
          parsearNumero(json.transferencia) ??
          parsearNumero(json.venta) ??
          parsearNumero(json.compra)
        if (tasa) {
          const fecha = json.fecha?.slice(0, 10) ?? null
          return { tasa, fecha, fuente: fuente.nombre }
        }
      } else {
        const html = await respuesta.text()
        const tasa = parsearHTMLBCV(html)
        if (tasa) return { tasa, fecha: null, fuente: fuente.nombre }
      }
    } catch {
      // Intenta la siguiente fuente.
    }
  }
  return null
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const autorizacion = request.headers.get("authorization")
    if (!secret || autorizacion !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
    }

    const resultado = await obtenerTasaBCV()
    if (!resultado) {
      return NextResponse.json(
        { ok: false, error: "No se pudo obtener la tasa BCV de ninguna fuente." },
        { status: 502 }
      )
    }

    const fecha = resultado.fecha ?? new Date().toISOString().slice(0, 10)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("bcv_rates")
      .upsert(
        {
          fecha,
          tasa: Math.round(resultado.tasa * 100) / 100,
          fuente: resultado.fuente,
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
      fallbackUsado: false,
      _fallback: TASA_BCV_FALLBACK,
    })
  } catch (cause) {
    const mensaje = cause instanceof Error ? cause.message : "Error inesperado"
    console.error("[cron-bcv] Error:", mensaje)
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 })
  }
}
