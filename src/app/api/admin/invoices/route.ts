/**
 * MEDISYS · API de facturación (Módulo 2)
 * ======================================================================
 * `GET  /api/admin/invoices?clinicSlug=...&desde=&hasta=&sedeId=&status=
 *                        &paymentStatus=&patientId=&q=&limite=`
 *   Lista las facturas de la clínica con filtros (requiere `facturacion:leer`).
 *
 * `POST /api/admin/invoices`
 *   Crea y (por defecto) emite una factura con su desglose de IVA/IGTF y la
 *   tasa BCV aplicada. Cuerpo: `{ clinicSlug, factura: { sedeId, patientId,
 *   fiscalProfile, items[], bcvRate?, emitir?, notas?, cobro? } }`
 *   (también acepta los campos en la raíz). Requiere `facturacion:emitir`.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { crearFactura, listarFacturas } from "@/lib/admin/facturas"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import type { FacturaFiltros } from "@/types/billing"
import type { InvoicePaymentStatus, InvoiceStatus } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ESTADOS: readonly string[] = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "CANCELLED",
  "REFUNDED",
]
const ESTADOS_COBRO: readonly string[] = ["PENDING", "PARTIAL", "PAID"]

/** Construye los filtros del listado desde la query string. */
function filtrosDesdeUrl(url: string): Partial<FacturaFiltros> {
  const { searchParams } = new URL(url)
  const status = searchParams.get("status")
  const paymentStatus = searchParams.get("paymentStatus")
  const limite = Number(searchParams.get("limite"))

  return {
    desde: searchParams.get("desde"),
    hasta: searchParams.get("hasta"),
    sedeId: searchParams.get("sedeId"),
    patientId: searchParams.get("patientId"),
    q: searchParams.get("q"),
    status:
      status && ESTADOS.includes(status) ? (status as InvoiceStatus) : "TODAS",
    paymentStatus:
      paymentStatus && ESTADOS_COBRO.includes(paymentStatus)
        ? (paymentStatus as InvoicePaymentStatus)
        : "TODAS",
    limite: Number.isFinite(limite) && limite > 0 ? limite : 100,
  }
}

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "facturacion:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await listarFacturas(
    supabase,
    staff.tenantId,
    filtrosDesdeUrl(request.url)
  )
  if (!resultado.ok) return responder(resultado)

  return NextResponse.json({
    ok: true,
    data: { facturas: resultado.data, total: resultado.data.length },
  })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "facturacion:emitir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await crearFactura(
    supabase,
    staff.tenantId,
    staff.userId,
    cuerpo.factura ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/facturacion`, "page")
  revalidatePath(`/${staff.slug}/admin`, "page")

  return responder(resultado, 201)
}
