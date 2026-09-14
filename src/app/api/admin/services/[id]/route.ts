/**
 * MEDISYS · API del módulo de administración · Servicio concreto
 * ===============================================================
 * `PATCH  /api/admin/services/:id`
 *   - Cuerpo completo → actualiza el servicio (`servicios:escribir`).
 *   - `{ accion: "alternar", activo: boolean }` → activa/desactiva (baja lógica).
 *
 * `DELETE /api/admin/services/:id`
 *   Elimina el servicio del catálogo (`servicios:escribir`).
 */
import { revalidatePath } from "next/cache"

import {
  actualizarServicio,
  alternarServicio,
  eliminarServicio,
} from "@/lib/admin/servicios"
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
    permiso: "servicios:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data

  // Acción explícita de encendido/apagado (switch de la lista).
  if (cuerpo.accion === "alternar") {
    const alternado = await alternarServicio(
      supabase,
      staff.tenantId,
      id,
      cuerpo.activo !== false
    )
    if (!alternado.ok) return responder(alternado)
    revalidatePath(`/${staff.slug}/admin/servicios`, "page")
    return responder(alternado)
  }

  const resultado = await actualizarServicio(
    supabase,
    staff.tenantId,
    id,
    cuerpo.servicio ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/servicios`, "page")
  revalidatePath(`/${staff.slug}/reservar`, "page")

  return responder(resultado)
}

export async function DELETE(request: Request, { params }: RutaParams) {
  const { id } = await params
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "servicios:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await eliminarServicio(supabase, staff.tenantId, id)
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/servicios`, "page")
  return responder(resultado)
}
