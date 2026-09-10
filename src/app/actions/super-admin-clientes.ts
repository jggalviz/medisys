"use server"

/**
 * MEDISYS · Detalle de un cliente para el Super Admin.
 *
 * `getClienteDetalle` devuelve la ficha completa de una clínica:
 * datos generales, especialistas asociados, citas activas y suscripción.
 * Exige `user_metadata.role === 'super_admin'` y usa service_role.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { getSuperAdmin } from "@/lib/super-admin"
import type { AppointmentStatus, PlanTenant } from "@/types/database"
import type { SuperAdminResult } from "@/app/actions/super-admin"

export type ClienteDoctor = {
  id: string
  nombre: string
  especialidad: string
  activo: boolean
  precioConsulta: number
}

export type ClienteCita = {
  id: string
  doctorNombre: string
  fechaHora: string
  estado: string
}

export type ClienteDetalle = {
  id: string
  nombre: string
  slug: string
  planType: PlanTenant
  maxEspecialistas: number
  isActive: boolean
  telefono: string | null
  rif: string | null
  direccion: string | null
  logoUrl: string | null
  createdAt: string
  suscripcionVenceAt: string | null
  totalCitas: number
  doctores: ClienteDoctor[]
  citasActivas: ClienteCita[]
}

/** Estados considerados "citas activas" (aún no finalizadas). */
const ESTADOS_ACTIVOS: AppointmentStatus[] = [
  "pendiente",
  "pendiente_validacion",
  "pago_en_recepcion",
  "confirmada",
  "en_espera",
  "en_consulta",
]

type Fila = Record<string, unknown>

function texto(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function numero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function nombreDoctor(row: Fila): string {
  const completo = [texto(row.nombres), texto(row.apellidos)].join(" ").trim()
  return completo || texto(row.nombre) || "Especialista"
}

export async function getClienteDetalle(
  tenantId: string
): Promise<SuperAdminResult<ClienteDetalle>> {
  try {
    const sesion = await getSuperAdmin()
    if (!sesion) {
      return { ok: false, message: "No autorizado: requiere super admin." }
    }
    if (!tenantId.trim()) return { ok: false, message: "Falta el cliente." }

    const supabase = createAdminClient()

    const [
      { data: tenant, error: errTenant },
      { data: doctores },
      { data: citas, error: errCitas },
      { count: totalCitas },
    ] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
      supabase.from("doctors").select("*").eq("tenant_id", tenantId),
      supabase
        .from("appointments")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("estado", ESTADOS_ACTIVOS)
        .order("fecha_hora", { ascending: true })
        .limit(30),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ])

    if (errTenant) return { ok: false, message: errTenant.message }
    if (!tenant) return { ok: false, message: "Cliente no encontrado." }
    if (errCitas) return { ok: false, message: errCitas.message }

    const filasDoctores = (doctores ?? []) as unknown as Fila[]
    const mapaDoctores = new Map<string, string>()
    const listaDoctores: ClienteDoctor[] = filasDoctores.map((d) => {
      const id = texto(d.id)
      const nombre = nombreDoctor(d)
      mapaDoctores.set(id, nombre)
      return {
        id,
        nombre,
        especialidad: texto(d.especialidad) || "General",
        activo: d.activo !== false && d.is_active !== false,
        precioConsulta: numero(d.precio_consulta),
      }
    })

    const citasActivas: ClienteCita[] = ((citas ?? []) as unknown as Fila[]).map((c) => ({
      id: texto(c.id),
      doctorNombre: mapaDoctores.get(texto(c.doctor_id)) ?? "Especialista",
      fechaHora: texto(c.fecha_hora),
      estado: texto(c.estado) || "pendiente",
    }))

    return {
      ok: true,
      data: {
        id: texto(tenant.id),
        nombre: texto(tenant.nombre) || "Clínica sin nombre",
        slug: texto(tenant.slug),
        planType: tenant.plan_type === "PRO" ? "PRO" : "CLINICA",
        maxEspecialistas:
          tenant.plan_type === "PRO" ? 1 : numero(tenant.max_especialistas) || 5,
        isActive: tenant.is_active !== false,
        telefono: tenant.telefono == null ? null : texto(tenant.telefono),
        rif: tenant.rif == null ? null : texto(tenant.rif),
        direccion: tenant.direccion == null ? null : texto(tenant.direccion),
        logoUrl: tenant.logo_url == null ? null : texto(tenant.logo_url),
        createdAt: texto(tenant.created_at),
        suscripcionVenceAt:
          tenant.suscripcion_vence_at == null
            ? null
            : texto(tenant.suscripcion_vence_at),
        totalCitas: totalCitas ?? 0,
        doctores: listaDoctores,
        citasActivas,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar el cliente.",
    }
  }
}
