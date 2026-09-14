/**
 * MEDISYS · API de cierres y arqueos de caja (Módulo 3)
 * ======================================================================
 * `GET /api/admin/closings?clinicSlug=...&sedeId=&status=&desde=&hasta=&limite=`
 *   Histórico de arqueos por sede (`contabilidad:leer`).
 *   Con `fecha=YYYY-MM-DD` devuelve además el arqueo calculado del sistema.
 *
 * `POST /api/admin/closings`
 *   Abre/cierra la caja del día con el conteo físico recibido:
 *   `{ clinicSlug, cierre: { closingId?, sedeId, closingDate, finalizar,
 *      conteo: [{ method, countedUSD, countedVES }], notes? } }`
 *   Requiere `contabilidad:escribir`.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import {
  arqueoDelDia,
  guardarCierre,
  listarCierres,
} from "@/lib/admin/contabilidad"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import type { DailyClosingStatus } from "@/types/database"
import { ESTADOS_CIERRE } from "@/lib/validations/accounting"

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
  const status = searchParams.get("status")
  const limite = Number(searchParams.get("limite"))
  const fecha = searchParams.get("fecha")
  const sedeId = searchParams.get("sedeId")

  const cierres = await listarCierres(supabase, staff.tenantId, {
    sedeId,
    status:
      status && (ESTADOS_CIERRE as readonly string[]).includes(status)
        ? (status as DailyClosingStatus)
        : "TODOS",
    desde: searchParams.get("desde"),
    hasta: searchParams.get("hasta"),
    limite: Number.isFinite(limite) && limite > 0 ? limite : 60,
  })
  if (!cierres.ok) return responder(cierres)

  // El arqueo del día se calcula siempre para el formulario de cuadre.
  const arqueo = fecha
    ? await arqueoDelDia(supabase, staff.tenantId, {
        closingDate: fecha,
        sedeId,
      })
    : null

  return NextResponse.json({
    ok: true,
    data: {
      cierres: cierres.data,
      total: cierres.data.length,
      arqueo: arqueo && arqueo.ok ? arqueo.data : null,
      arqueoAviso: arqueo && !arqueo.ok ? arqueo.message : null,
    },
  })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "contabilidad:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await guardarCierre(
    supabase,
    staff.tenantId,
    staff.userId,
    cuerpo.cierre ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/contabilidad`, "page")
  revalidatePath(`/${staff.slug}/admin`, "page")

  return responder(resultado, 201)
}
