/**
 * MEDISYS · API de liquidaciones de honorarios · Liquidación concreta (Módulo 3)
 * =============================================================================
 * `PATCH /api/admin/settlements/:id`
 *   Cambia el estado: `{ clinicSlug, accion: "aprobar" | "pagar" | "notas",
 *   paymentReference?, notes? }`. Requiere `honorarios:escribir`.
 */
import { revalidatePath } from "next/cache"

import { actualizarLiquidacion } from "@/lib/admin/contabilidad"
import {
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RutaParams = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RutaParams) {
  const { id } = await params
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "honorarios:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await actualizarLiquidacion(
    supabase,
    staff.tenantId,
    staff.userId,
    id,
    cuerpo.liquidacion ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/contabilidad`, "page")
  return responder(resultado)
}
