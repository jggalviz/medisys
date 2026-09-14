/**
 * MEDISYS · API del módulo de administración · Sede concreta
 * ===========================================================
 * `PATCH  /api/admin/sedes/:id`
 *   - Cuerpo completo → actualiza la sede (`sedes:escribir`).
 *   - `{ accion: "alternar", activo: boolean }` → activa/desactiva.
 *
 * `DELETE /api/admin/sedes/:id` → elimina la sede (`sedes:escribir`).
 */
import { revalidatePath } from "next/cache"

import { actualizarSede, alternarSede, eliminarSede } from "@/lib/admin/sedes"
import {
  identificadorDesdeUrl,
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
    permiso: "sedes:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data

  if (cuerpo.accion === "alternar") {
    const alternado = await alternarSede(
      supabase,
      staff.tenantId,
      id,
      cuerpo.activo !== false
    )
    if (!alternado.ok) return responder(alternado)
    revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
    return responder(alternado)
  }

  const resultado = await actualizarSede(
    supabase,
    staff.tenantId,
    id,
    cuerpo.sede ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
  return responder(resultado)
}

export async function DELETE(request: Request, { params }: RutaParams) {
  const { id } = await params
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "sedes:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await eliminarSede(supabase, staff.tenantId, id)
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
  return responder(resultado)
}
