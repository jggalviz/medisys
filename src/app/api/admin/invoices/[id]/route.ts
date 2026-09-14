/**
 * MEDISYS · API de facturación · Factura concreta
 * ================================================
 * `GET /api/admin/invoices/:id?clinicSlug=...`
 *   Devuelve la factura con su detalle, cobros y notas (`facturacion:leer`).
 */
import { obtenerFactura } from "@/lib/admin/facturas"
import {
  identificadorDesdeUrl,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RutaParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RutaParams) {
  const { id } = await params
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "facturacion:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await obtenerFactura(supabase, staff.tenantId, id)
  return responder(resultado)
}
