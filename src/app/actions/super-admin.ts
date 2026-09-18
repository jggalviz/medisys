"use server"

/**
 * MEDISYS · Server Actions del Super Admin (`/super-admin`).
 * Todas verifican `user.user_metadata.role === 'super_admin'`.
 * Las operaciones globales usan el cliente service_role (bypass RLS).
 */
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSuperAdmin } from "@/lib/super-admin"
import {
  ETIQUETA_PLAN,
  LIMITE_ESPECIALISTAS_PLAN,
  PLANES_TENANT,
  ajustarMaxEspecialistas,
  normalizarPlan,
  rangoEspecialistasPlan,
} from "@/lib/suscripcion"
import type { PlanTenant } from "@/types/database"

export type SuperAdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type SuperAdminMetrics = {
  totalTenants: number
  individual: number
  pyme: number
  pro: number
  activos: number
  totalDoctores: number
  totalCitas: number
}

export type TenantAdminRow = {
  id: string
  nombre: string
  slug: string
  plan_type: PlanTenant
  max_especialistas: number
  is_active: boolean
  telefono: string | null
  created_at: string
}

export type SuperAdminSnapshot = {
  metrics: SuperAdminMetrics
  tenants: TenantAdminRow[]
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function numero(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

async function exigirSuperAdmin(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const sesion = await getSuperAdmin()
  if (!sesion) return { ok: false, message: "No autorizado: requiere super admin." }
  return { ok: true }
}

/* --------------------------- Dashboard --------------------------- */

/** Métricas globales + listado de tenants para el dashboard central. */
export async function getSuperAdminSnapshot(): Promise<
  SuperAdminResult<SuperAdminSnapshot>
> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const supabase = createAdminClient()

    const [
      { data: tenants, error: errTenants },
      { count: totalDoctores },
      { count: totalCitas },
    ] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("doctors").select("id", { count: "exact", head: true }),
      supabase.from("appointments").select("id", { count: "exact", head: true }),
    ])

    if (errTenants) return { ok: false, message: errTenants.message }

    const filas = (tenants ?? []) as unknown as Record<string, unknown>[]
    const lista: TenantAdminRow[] = filas.map((fila) => {
      // Tolerante a valores heredados ('PRO' de 1 especialista, 'CLINICA',
      // 'independiente', 'multi_especialista'): ver `normalizarPlan`.
      const plan = normalizarPlan(fila.plan_type, Number(fila.max_especialistas))
      return {
        id: texto(fila.id),
        nombre: texto(fila.nombre) || "Clínica sin nombre",
        slug: texto(fila.slug),
        plan_type: plan,
        max_especialistas:
          plan === "INDIVIDUAL" ? 1 : numero(fila.max_especialistas, 5),
        is_active: fila.is_active !== false,
        telefono: fila.telefono == null ? null : texto(fila.telefono),
        created_at: texto(fila.created_at),
      }
    })

    const metrics: SuperAdminMetrics = {
      totalTenants: lista.length,
      individual: lista.filter((t) => t.plan_type === "INDIVIDUAL").length,
      pyme: lista.filter((t) => t.plan_type === "PYME").length,
      pro: lista.filter((t) => t.plan_type === "PRO").length,
      activos: lista.filter((t) => t.is_active).length,
      totalDoctores: totalDoctores ?? 0,
      totalCitas: totalCitas ?? 0,
    }

    return { ok: true, data: { metrics, tenants: lista } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar métricas.",
    }
  }
}

/** Activa/desactiva un tenant (`tenants.is_active`). */
export async function toggleTenantActive(
  tenantId: string,
  activo: boolean
): Promise<SuperAdminResult<{ id: string; is_active: boolean }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!tenantId.trim()) return { ok: false, message: "Falta el tenant." }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("tenants")
      .update({ is_active: activo })
      .eq("id", tenantId)
      .select("id, is_active")
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: "No se encontró el tenant." }
    return { ok: true, data: { id: data.id, is_active: data.is_active !== false } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al actualizar.",
    }
  }
}

/**
 * Cambia el plan comercial del tenant (INDIVIDUAL · PYME · PRO) y ajusta el
 * cupo de especialistas al rango del nuevo plan.
 */
export async function updateTenantPlan(
  tenantId: string,
  plan: PlanTenant
): Promise<
  SuperAdminResult<{ id: string; plan_type: PlanTenant; max_especialistas: number }>
> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!tenantId.trim()) return { ok: false, message: "Falta el tenant." }
    if (!PLANES_TENANT.includes(plan)) {
      return { ok: false, message: "Plan no válido." }
    }

    const supabase = createAdminClient()
    const { data: tenant, error: errTenant } = await supabase
      .from("tenants")
      .select("id, plan_type, max_especialistas")
      .eq("id", tenantId)
      .maybeSingle()
    if (errTenant) return { ok: false, message: errTenant.message }
    if (!tenant) return { ok: false, message: "No se encontró el tenant." }

    const max = ajustarMaxEspecialistas(plan, tenant.max_especialistas)

    const { data, error } = await supabase
      .from("tenants")
      .update({ plan_type: plan, max_especialistas: max })
      .eq("id", tenantId)
      .select("id, plan_type, max_especialistas")
      .maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: "No se pudo actualizar el plan." }

    return {
      ok: true,
      data: {
        id: data.id,
        plan_type: normalizarPlan(data.plan_type, data.max_especialistas),
        max_especialistas: numero(data.max_especialistas, max),
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al actualizar.",
    }
  }
}

/** Modifica el límite de especialistas (sedes/asientos adicionales). */
export async function updateTenantMaxEspecialistas(
  tenantId: string,
  maxEspecialistas: number
): Promise<SuperAdminResult<{ id: string; max_especialistas: number }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!tenantId.trim()) return { ok: false, message: "Falta el tenant." }

    const supabase = createAdminClient()
    const { data: tenant, error: errTenant } = await supabase
      .from("tenants")
      .select("id, plan_type, max_especialistas")
      .eq("id", tenantId)
      .maybeSingle()
    if (errTenant) return { ok: false, message: errTenant.message }
    if (!tenant) return { ok: false, message: "No se encontró el tenant." }

    const plan = normalizarPlan(tenant.plan_type, tenant.max_especialistas)
    const limite = LIMITE_ESPECIALISTAS_PLAN[plan]
    const cupo = Math.floor(Number(maxEspecialistas))
    const fueraDeRango =
      !Number.isFinite(cupo) ||
      cupo < limite.min ||
      (limite.max !== null && cupo > limite.max)

    if (fueraDeRango) {
      return {
        ok: false,
        message: `${ETIQUETA_PLAN[plan]} admite ${rangoEspecialistasPlan(plan)}.`,
      }
    }

    const max = ajustarMaxEspecialistas(plan, cupo)

    const { data, error } = await supabase
      .from("tenants")
      .update({ max_especialistas: max })
      .eq("id", tenantId)
      .select("id, max_especialistas")
      .maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: "No se pudo actualizar el límite." }

    return {
      ok: true,
      data: { id: data.id, max_especialistas: numero(data.max_especialistas, max) },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al actualizar.",
    }
  }
}

export type SuperAdminSignInResult =
  | { ok: true }
  | { ok: false; message: string }

/** Inicia sesión y exige `user_metadata.role === 'super_admin'`. */
export async function signInSuperAdmin(
  email: string,
  password: string
): Promise<SuperAdminSignInResult> {
  const correo = email.trim().toLowerCase()
  if (!correo || !password) {
    return { ok: false, message: "Ingresa tu correo y contraseña." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  })
  if (error || !data.user) {
    return { ok: false, message: "Credenciales inválidas." }
  }

  const metadata = data.user.user_metadata as Record<string, unknown> | undefined
  if (metadata?.role !== "super_admin") {
    await supabase.auth.signOut()
    return { ok: false, message: "Tu usuario no tiene rol de Super Admin." }
  }
  return { ok: true }
}

/** Cierra la sesión del super admin. */
export async function signOutSuperAdmin(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
