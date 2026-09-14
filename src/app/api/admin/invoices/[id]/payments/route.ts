/**
 * MEDISYS · API de facturación · Registro de cobros
 * ==================================================
 * `POST /api/admin/invoices/:id/payments`
 *   Registra un cobro multimoneda y calcula el IGTF del 3% cuando el método es
 *   en divisas (Zelle, Efectivo USD). Cuerpo:
 *   `{ clinicSlug, pago: { method, amountUSD?, amountVES?, referenceNumber?,
 *      notes?, verificar? } }` (también acepta los campos en la raíz).
 *   Requiere permiso `cobros:registrar`.
 *
 * La factura debe estar emitida (con N° de factura y control) y no anulada.
 */
import { revalidatePath } from "next/cache"

import { registrarPago } from "@/lib/admin/facturas"
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
    permiso: "cobros:registrar",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await registrarPago(
    supabase,
    staff.tenantId,
    staff.userId,
    id,
    cuerpo.pago ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/facturacion`, "page")
  revalidatePath(`/${staff.slug}/admin/recepcion`, "page")

  return responder(resultado, 201)
}
