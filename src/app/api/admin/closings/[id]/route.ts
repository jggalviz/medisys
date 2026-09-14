/**
 * MEDISYS · API de cierres y arqueos de caja · Cierre concreto (Módulo 3)
 * =======================================================================
 * `GET   /api/admin/closings/:id?clinicSlug=...`
 *   Detalle del cierre con el arqueo calculado del sistema (`contabilidad:leer`).
 *
 * `PATCH /api/admin/closings/:id`
 *   Cambia el estado del cierre: `{ accion: "cerrar" | "auditar" | "notas",
 *   notes? }` (`contabilidad:escribir` para cerrar, `honorarios:escribir`
 *   —admin/contador— para auditar).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import {
  actualizarCierre,
  arqueoDelDia,
  listarCierres,
} from "@/lib/admin/contabilidad"
import {
  identificadorDesdeUrl,
  leerCuerpoJson,
  leerIdentificadorClinica,
  responder,
  resolverContextoAdmin,
} from "@/lib/admin/sesion"
import { actualizarCierreSchema } from "@/lib/validations/accounting"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RutaParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RutaParams) {
  const { id } = await params
  const { clinicSlug, tenantId } = identificadorDesdeUrl(request.url)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "contabilidad:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const cierres = await listarCierres(supabase, staff.tenantId, { limite: 365 })
  if (!cierres.ok) return responder(cierres)

  const cierre = cierres.data.find((item) => item.id === id)
  if (!cierre) {
    return responder({
      ok: false,
      code: "NOT_FOUND",
      message: "El cierre de caja no existe en esta clínica.",
    })
  }

  const arqueo = await arqueoDelDia(supabase, staff.tenantId, {
    closingDate: cierre.closingDate,
    sedeId: cierre.sedeId,
  })

  return NextResponse.json({
    ok: true,
    data: {
      cierre,
      arqueo: arqueo.ok ? arqueo.data : null,
      arqueoAviso: arqueo.ok ? null : arqueo.message,
    },
  })
}

export async function PATCH(request: Request, { params }: RutaParams) {
  const { id } = await params
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  // Auditar requiere rol de contabilidad; cerrar/notas basta con caja.
  const valido = actualizarCierreSchema.safeParse(cuerpo.accion ? cuerpo : cuerpo.cierre)
  const accion = valido.success ? valido.data.accion : "cerrar"
  const permiso = accion === "auditar" ? "honorarios:escribir" : "contabilidad:escribir"

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso,
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await actualizarCierre(
    supabase,
    staff.tenantId,
    staff.userId,
    id,
    cuerpo.cierre ?? cuerpo
  )
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/contabilidad`, "page")
  return responder(resultado)
}
