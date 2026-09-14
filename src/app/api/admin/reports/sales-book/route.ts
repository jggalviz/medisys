/**
 * MEDISYS · API del Libro de Ventas SENIAT (Módulo 3)
 * ======================================================================
 * `GET /api/admin/reports/sales-book?clinicSlug=...&anio=2026&mes=9
 *                          &sedeId=...&formato=json|csv`
 *
 * Devuelve el libro del mes en el orden de la providencia del SENIAT con su
 * resumen de IVA e IGTF. Con `formato=csv` responde un archivo descargable
 * (`text/csv`) listo para Excel/Google Sheets.
 *
 * Requiere permiso `contabilidad:leer`.
 */
import { NextResponse } from "next/server"

import { generarLibroVentas } from "@/lib/admin/libro-ventas"
import {
  identificadorDesdeUrl,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import { libroVentasACSV, nombreArchivoLibro } from "@/lib/accounting-ve"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const { searchParams } = new URL(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "contabilidad:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const anio = Number(searchParams.get("anio"))
  const mes = Number(searchParams.get("mes"))

  const resultado = await generarLibroVentas(supabase, staff.tenantId, {
    anio: Number.isFinite(anio) && anio > 0 ? anio : null,
    mes: Number.isFinite(mes) && mes > 0 ? mes : null,
    sedeId: searchParams.get("sedeId"),
    formato: searchParams.get("formato") === "csv" ? "csv" : "json",
  })
  if (!resultado.ok) return responder(resultado)

  if (searchParams.get("formato") === "csv") {
    const csv = libroVentasACSV(resultado.data)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreArchivoLibro(resultado.data)}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  return NextResponse.json({ ok: true, data: resultado.data })
}
