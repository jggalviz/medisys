/**
 * MEDISYS · API del módulo de administración · Entidad fiscal y ajustes
 * =====================================================================
 * `GET   /api/admin/settings?clinicSlug=...`
 *   Devuelve la entidad fiscal, la tasa vigente, las sedes y los permisos del
 *   usuario autenticado (todo en un solo viaje para la vista de configuración).
 *
 * `PATCH /api/admin/settings`
 *   Guarda la entidad fiscal (razón social, RIF, domicilio, contacto e
 *   imprenta autorizada). Requiere permiso `fiscal:escribir`.
 *
 * Autenticación: cookies de Supabase (personal de la clínica). La clínica se
 * identifica con `clinicSlug` (preferido) o `tenantId`.
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { leerEntidadFiscal, guardarEntidadFiscal } from "@/lib/admin/fiscal"
import { listarSedes } from "@/lib/admin/sedes"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import { getTasaVigente } from "@/lib/currency-rates"
import { permisosDeRol } from "@/lib/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)
  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "configuracion:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data

  const [fiscal, sedes, tasa] = await Promise.all([
    leerEntidadFiscal(supabase, staff.tenantId),
    listarSedes(supabase, staff.tenantId),
    getTasaVigente(supabase),
  ])

  if (!fiscal.ok) return responder(fiscal)

  return NextResponse.json({
    ok: true,
    data: {
      clinic: {
        tenantId: staff.tenantId,
        clinicSlug: staff.slug,
        nombre: staff.tenantNombre,
        role: staff.role,
        sedeIds: staff.sedeIds,
        permisos: permisosDeRol(staff.role),
      },
      fiscal: fiscal.data,
      /* La migración 0016 puede no estar aplicada: se informa sin romper. */
      sedes: sedes.ok ? sedes.data : [],
      sedesAviso: sedes.ok ? null : sedes.message,
      tasa,
    },
  })
}

export async function PATCH(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "fiscal:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const entrada = cuerpo.fiscal ?? cuerpo

  const resultado = await guardarEntidadFiscal(supabase, staff.tenantId, entrada)
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
  revalidatePath(`/${staff.slug}`, "page")
  revalidatePath(`/${staff.slug}`, "layout")

  return responder(resultado)
}
