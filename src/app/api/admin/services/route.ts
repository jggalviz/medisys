/**
 * MEDISYS · API del módulo de administración · Catálogo de servicios
 * ==================================================================
 * `GET  /api/admin/services?clinicSlug=...&activo=true`
 *   Lista el catálogo de servicios médicos de la clínica.
 *   Requiere permiso `servicios:leer` (admin, recepción, contador, médico).
 *
 * `POST /api/admin/services`
 *   Crea un servicio. Cuerpo: `{ clinicSlug, servicio: { title, code,
 *   priceUSD, taxable, doctorCommissionType, doctorCommissionValue,
 *   doctorId?, activo? } }` (también acepta los campos en la raíz).
 *   Requiere permiso `servicios:escribir` (solo administrador).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { crearServicio, listarServicios } from "@/lib/admin/servicios"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "servicios:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const { searchParams } = new URL(request.url)
  const soloActivos = searchParams.get("activo") === "true"

  const resultado = await listarServicios(supabase, staff.tenantId)
  if (!resultado.ok) return responder(resultado)

  const servicios = soloActivos
    ? resultado.data.filter((servicio) => servicio.activo)
    : resultado.data

  return NextResponse.json({
    ok: true,
    data: { servicios, total: servicios.length },
  })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "servicios:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await crearServicio(
    supabase,
    staff.tenantId,
    cuerpo.servicio ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/servicios`, "page")
  revalidatePath(`/${staff.slug}/reservar`, "page")

  return responder(resultado, 201)
}
