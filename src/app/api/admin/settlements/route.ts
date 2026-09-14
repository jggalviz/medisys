/**
 * MEDISYS · API de liquidaciones de honorarios (Módulo 3)
 * ======================================================================
 * `GET  /api/admin/settlements?clinicSlug=...&doctorId=&status=&desde=&hasta=`
 *   Lista las liquidaciones (`honorarios:leer`).
 *
 * `POST /api/admin/settlements`
 *   Genera y (opcionalmente) aprueba la liquidación del período.
 *   Cuerpo: `{ clinicSlug, liquidacion: { doctorId, periodStart, periodEnd,
 *   bcvRate?, aprobar?, notes? } }`. Requiere `honorarios:escribir`.
 *
 * Con `?preview=1&doctorId=&desde=&hasta=` el GET devuelve el cálculo previo
 * sin escribir nada (mismo motor que la generación).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import {
  calcularLiquidacion,
  generarLiquidacion,
  listarLiquidaciones,
} from "@/lib/admin/contabilidad"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import { ESTADOS_LIQUIDACION } from "@/lib/validations/accounting"
import type { SettlementStatus } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const { searchParams } = new URL(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "honorarios:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const doctorId = searchParams.get("doctorId")
  const limite = Number(searchParams.get("limite"))

  // Cálculo previo (sin escribir): mismo motor que la generación.
  if (searchParams.get("preview") === "1") {
    if (!doctorId) {
      return responder({
        ok: false,
        code: "INVALID_INPUT",
        message: "Indica el especialista (`doctorId`) para calcular la vista previa.",
      })
    }
    const preview = await calcularLiquidacion(supabase, staff.tenantId, {
      doctorId,
      periodStart: searchParams.get("desde") ?? "",
      periodEnd: searchParams.get("hasta") ?? "",
    })
    return responder(preview)
  }

  const status = searchParams.get("status")
  const liquidaciones = await listarLiquidaciones(supabase, staff.tenantId, {
    doctorId,
    status:
      status && (ESTADOS_LIQUIDACION as readonly string[]).includes(status)
        ? (status as SettlementStatus)
        : "TODOS",
    desde: searchParams.get("desde"),
    hasta: searchParams.get("hasta"),
    limite: Number.isFinite(limite) && limite > 0 ? limite : 100,
  })
  if (!liquidaciones.ok) return responder(liquidaciones)

  return NextResponse.json({
    ok: true,
    data: {
      liquidaciones: liquidaciones.data,
      total: liquidaciones.data.length,
    },
  })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "honorarios:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await generarLiquidacion(
    supabase,
    staff.tenantId,
    staff.userId,
    cuerpo.liquidacion ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/contabilidad`, "page")
  return responder(resultado, 201)
}
