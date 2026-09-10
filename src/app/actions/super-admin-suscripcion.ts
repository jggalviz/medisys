"use server"

/**
 * MEDISYS · Suscripciones (lado Super Admin).
 *
 *  - `getPagosSuscripcionPendientes`: reportes con estado 'PENDIENTE'.
 *  - `aprobarPagoSuscripcion`: marca 'APROBADO' y extiende +30 días.
 *  - `rechazarPagoSuscripcion`: marca 'RECHAZADO'.
 *  - `extenderMembresiaTenant`: suma días a `suscripcion_vence_at`.
 *
 * Todas exigen `user_metadata.role === 'super_admin'` y usan service_role.
 */
import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { getSuperAdmin } from "@/lib/super-admin"
import { DIAS_RENOVACION } from "@/lib/suscripcion"
import type { PlanTenant } from "@/types/database"

export type SuscripcionAdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type PagoSuscripcionPendiente = {
  id: string
  tenantId: string
  tenantNombre: string
  tenantSlug: string
  planType: PlanTenant
  montoUsd: number
  montoVes: number
  tasaBcv: number
  bancoOrigen: string | null
  referencia: string
  telefonoEmisor: string | null
  comprobanteUrl: string | null
  createdAt: string
}

type PagoRow = Record<string, unknown>

function texto(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function numero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function exigirSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const sesion = await getSuperAdmin()
  if (!sesion) return { ok: false, message: "No autorizado: requiere super admin." }
  return { ok: true, userId: sesion.userId }
}

/** Lista los pagos de suscripción pendientes de validación. */
export async function getPagosSuscripcionPendientes(): Promise<
  SuscripcionAdminResult<PagoSuscripcionPendiente[]>
> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const supabase = createAdminClient()
    const { data: pagos, error } = await supabase
      .from("saas_subscription_payments")
      .select("*")
      .eq("estado", "PENDIENTE")
      .order("created_at", { ascending: true })

    if (error) return { ok: false, message: error.message }

    const filas = (pagos ?? []) as unknown as PagoRow[]
    const tenantIds = Array.from(
      new Set(filas.map((f) => texto(f.tenant_id)).filter(Boolean))
    )

    const tenants = new Map<string, { nombre: string; slug: string }>()
    if (tenantIds.length > 0) {
      const { data: clinicas } = await supabase
        .from("tenants")
        .select("id, nombre, slug")
        .in("id", tenantIds)
      for (const c of (clinicas ?? []) as unknown as PagoRow[]) {
        tenants.set(texto(c.id), {
          nombre: texto(c.nombre) || "Clínica sin nombre",
          slug: texto(c.slug),
        })
      }
    }

    const lista: PagoSuscripcionPendiente[] = filas.map((f) => {
      const tenantId = texto(f.tenant_id)
      const info = tenants.get(tenantId)
      return {
        id: texto(f.id),
        tenantId,
        tenantNombre: info?.nombre ?? "Clínica eliminada",
        tenantSlug: info?.slug ?? "",
        planType: f.plan_type === "PRO" ? "PRO" : "CLINICA",
        montoUsd: numero(f.monto_usd),
        montoVes: numero(f.monto_ves),
        tasaBcv: numero(f.tasa_bcv),
        bancoOrigen: f.banco_origen == null ? null : texto(f.banco_origen),
        referencia: texto(f.referencia_pago),
        telefonoEmisor: f.telefono_emisor == null ? null : texto(f.telefono_emisor),
        comprobanteUrl: f.comprobante_url == null ? null : texto(f.comprobante_url),
        createdAt: texto(f.created_at),
      }
    })

    return { ok: true, data: lista }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar pagos.",
    }
  }
}

/**
 * Suma `dias` a la fecha de vencimiento del tenant. Si ya venció (o no tiene
 * fecha), parte desde ahora. Asegura `is_active = true`.
 */
export async function extenderMembresiaTenant(input: {
  tenantId: string
  dias?: number
}): Promise<SuscripcionAdminResult<{ tenantId: string; venceAt: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso

    const tenantId = input.tenantId?.trim()
    if (!tenantId) return { ok: false, message: "Falta el tenant." }
    const dias = Math.max(1, Math.floor(input.dias ?? DIAS_RENOVACION))

    const supabase = createAdminClient()
    const { data: tenant, error: errTenant } = await supabase
      .from("tenants")
      .select("id, suscripcion_vence_at")
      .eq("id", tenantId)
      .maybeSingle()
    if (errTenant) return { ok: false, message: errTenant.message }
    if (!tenant) return { ok: false, message: "No se encontró la clínica." }

    const venceActual = tenant.suscripcion_vence_at
      ? new Date(String(tenant.suscripcion_vence_at)).getTime()
      : NaN
    const base =
      Number.isFinite(venceActual) && venceActual > Date.now() ? venceActual : Date.now()
    const nuevaFecha = new Date(base + dias * 86_400_000).toISOString()

    const { data: actualizado, error } = await supabase
      .from("tenants")
      .update({ suscripcion_vence_at: nuevaFecha, is_active: true })
      .eq("id", tenantId)
      .select("id, suscripcion_vence_at")
      .maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!actualizado) return { ok: false, message: "No se pudo extender la membresía." }

    return {
      ok: true,
      data: {
        tenantId: actualizado.id,
        venceAt: String(actualizado.suscripcion_vence_at ?? nuevaFecha),
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al extender membresía.",
    }
  }
}

/** Aprueba un pago pendiente y extiende la membresía +30 días. */
export async function aprobarPagoSuscripcion(
  pagoId: string
): Promise<SuscripcionAdminResult<{ tenantId: string; venceAt: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!pagoId.trim()) return { ok: false, message: "Falta el pago." }

    const supabase = createAdminClient()
    const { data: pago, error: errPago } = await supabase
      .from("saas_subscription_payments")
      .select("*")
      .eq("id", pagoId)
      .maybeSingle()
    if (errPago) return { ok: false, message: errPago.message }
    if (!pago) return { ok: false, message: "No se encontró el pago." }
    if (pago.estado !== "PENDIENTE") {
      return { ok: false, message: "Este pago ya fue procesado." }
    }

    const extension = await extenderMembresiaTenant({
      tenantId: pago.tenant_id,
      dias: DIAS_RENOVACION,
    })
    if (!extension.ok) return extension

    const { error } = await supabase
      .from("saas_subscription_payments")
      .update({
        estado: "APROBADO",
        aprobado_por: acceso.userId,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", pagoId)
    if (error) return { ok: false, message: error.message }

    revalidatePath("/super-admin/pagos")
    revalidatePath("/super-admin/dashboard")
    return {
      ok: true,
      data: { tenantId: extension.data.tenantId, venceAt: extension.data.venceAt },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al aprobar el pago.",
    }
  }
}

/** Rechaza un pago pendiente (no modifica la membresía). */
export async function rechazarPagoSuscripcion(
  pagoId: string
): Promise<SuscripcionAdminResult<{ id: string }>> {
  try {
    const acceso = await exigirSuperAdmin()
    if (!acceso.ok) return acceso
    if (!pagoId.trim()) return { ok: false, message: "Falta el pago." }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("saas_subscription_payments")
      .update({
        estado: "RECHAZADO",
        aprobado_por: acceso.userId,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", pagoId)
      .eq("estado", "PENDIENTE")
      .select("id")
      .maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: "El pago ya fue procesado." }

    revalidatePath("/super-admin/pagos")
    return { ok: true, data: { id: data.id } }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al rechazar el pago.",
    }
  }
}

