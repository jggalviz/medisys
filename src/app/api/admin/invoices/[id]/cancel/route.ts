/**
 * MEDISYS · API de facturación · Anulación y notas de ajuste
 * ===========================================================
 * `POST /api/admin/invoices/:id/cancel`
 *   Emite una nota de crédito (anulación/reembolso) o una nota de débito
 *   (cargo adicional), ambas con numeración y N° de control propios.
 *   Cuerpo:
 *   `{ clinicSlug, anulacion: { tipo: "CREDITO" | "DEBITO", motivo,
 *      montoUSD?, reembolsar? } }` (también acepta los campos en la raíz).
 *   Requiere permiso `facturacion:anular`.
 */
import { revalidatePath } from "next/cache"

import { anularFactura } from "@/lib/admin/facturas"
import {
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RutaParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RutaParams) {
  const { id } = await params
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "facturacion:anular",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await anularFactura(
    supabase,
    staff.tenantId,
    staff.userId,
    id,
    cuerpo.anulacion ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/facturacion`, "page")
  revalidatePath(`/${staff.slug}/admin`, "page")

  return responder(resultado, 201)
}
