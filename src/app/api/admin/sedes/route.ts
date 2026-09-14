/**
 * MEDISYS · API del módulo de administración · Sedes (multi-sede)
 * ================================================================
 * `GET  /api/admin/sedes?clinicSlug=...`  → lista las sedes de la clínica.
 * `POST /api/admin/sedes`                 → crea una sede (`sedes:escribir`).
 *
 * Cuerpo esperado: `{ clinicSlug, sede: { nombre, direccion?, telefono?,
 * esPrincipal?, activo? } }` (también acepta los campos en la raíz).
 */
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { crearSede, listarSedes } from "@/lib/admin/sedes"
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
    permiso: "sedes:leer",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await listarSedes(supabase, staff.tenantId)
  if (!resultado.ok) return responder(resultado)

  return NextResponse.json({
    ok: true,
    data: { sedes: resultado.data, total: resultado.data.length },
  })
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request)
  const { clinicSlug, tenantId } = leerIdentificadorClinica(cuerpo)

  const contexto = await resolverContextoAdmin({
    clinicSlug,
    tenantId,
    permiso: "sedes:escribir",
  })
  if (!contexto.ok) return responder(contexto)

  const { supabase, staff } = contexto.data
  const resultado = await crearSede(supabase, staff.tenantId, cuerpo.sede ?? cuerpo)
  if (!resultado.ok) return responder(resultado)

  revalidatePath(`/${staff.slug}/admin/configuracion`, "page")
  return responder(resultado, 201)
}
