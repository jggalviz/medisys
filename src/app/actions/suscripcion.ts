"use server"

/**
 * MEDISYS · Suscripción del tenant (lado clínica).
 *
 *  - `getInfoRenovacion`: plan, tasa BCV, monto en Bs. y datos de Pago Móvil
 *    oficiales del SaaS para la página /admin/renovar-membresia.
 *  - `registrarPagoSuscripcion`: guarda el reporte en
 *    `saas_subscription_payments` con estado 'PENDIENTE'.
 *
 * Solo rol 'admin'. El monto se calcula en el servidor con la tasa BCV.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, PlanTenant } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { getLatestBcvRate } from "@/lib/bcv"
import {
  datosPagoMovilSaas,
  nombrePlan,
  precioPlanUSD,
} from "@/lib/suscripcion"

export type SuscripcionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type RenovacionInfo = {
  tenantId: string
  planType: PlanTenant
  planLabel: string
  precioUsd: number
  tasaBCV: number
  montoVes: number
  venceAt: string | null
  pagoMovil: { banco: string; cedula: string; telefono: string; titular: string }
  /** Reporte ya enviado y aún no revisado (si existe). */
  pendiente: { id: string; referencia: string; createdAt: string } | null
}

export type RegistrarPagoInput = {
  tenantId: string
  bancoOrigen: string
  referenciaPago: string
  telefonoEmisor: string
  comprobanteUrl?: string | null
}

const REFERENCIA_RE = /^\d{4,6}$/

/** Exige sesión con rol 'admin' en el tenant. */
async function autorizarAdmin(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, message: "No autorizado: inicia sesión." }

  const { data: member } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!member || member.role !== "admin") {
    return { ok: false, message: "Solo el administrador puede renovar la membresía." }
  }
  return { ok: true }
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Plan + tasa + monto + datos de cobro para la pantalla de renovación. */
export async function getInfoRenovacion(
  tenantId: string
): Promise<SuscripcionResult<RenovacionInfo>> {
  try {
    if (!tenantId.trim()) return { ok: false, message: "Clínica no válida." }

    const supabase = await createClient()
    const acceso = await autorizarAdmin(supabase, tenantId)
    if (!acceso.ok) return acceso

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .maybeSingle()
    if (!tenant) return { ok: false, message: "Clínica no encontrada." }

    const planType: PlanTenant = tenant.plan_type === "PRO" ? "PRO" : "CLINICA"
    const precioUsd = precioPlanUSD(planType)
    const tasaBCV = await getLatestBcvRate(supabase)

    const { data: filas } = await supabase
      .from("saas_subscription_payments")
      .select("id, referencia_pago, created_at")
      .eq("tenant_id", tenantId)
      .eq("estado", "PENDIENTE")
      .order("created_at", { ascending: false })
      .limit(1)

    const primera = (filas ?? [])[0]
    const pendiente = primera
      ? {
          id: String(primera.id),
          referencia: String(primera.referencia_pago ?? ""),
          createdAt: String(primera.created_at ?? ""),
        }
      : null

    return {
      ok: true,
      data: {
        tenantId,
        planType,
        planLabel: nombrePlan(planType),
        precioUsd,
        tasaBCV,
        montoVes: redondear2(precioUsd * tasaBCV),
        venceAt: tenant.suscripcion_vence_at ?? null,
        pagoMovil: datosPagoMovilSaas(),
        pendiente,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al cargar la renovación.",
    }
  }
}

/** Registra el reporte de pago de la membresía (estado PENDIENTE). */
export async function registrarPagoSuscripcion(
  input: RegistrarPagoInput
): Promise<SuscripcionResult<{ id: string; montoVes: number; montoUsd: number }>> {
  try {
    const tenantId = input.tenantId?.trim()
    if (!tenantId) return { ok: false, message: "Clínica no válida." }

    const referencia = input.referenciaPago?.trim() ?? ""
    if (!REFERENCIA_RE.test(referencia)) {
      return {
        ok: false,
        message: "La referencia debe tener entre 4 y 6 dígitos.",
      }
    }

    const banco = input.bancoOrigen?.trim() ?? ""
    if (!banco) return { ok: false, message: "Indica el banco de origen." }

    const telefono = input.telefonoEmisor?.trim() ?? ""
    if (telefono.replace(/\D/g, "").length < 7) {
      return { ok: false, message: "Indica el teléfono emisor del pago." }
    }

    const comprobante = input.comprobanteUrl?.trim() || null
    if (comprobante && !/^https?:\/\//.test(comprobante)) {
      return { ok: false, message: "El comprobante adjunto no es válido." }
    }

    const supabase = await createClient()
    const acceso = await autorizarAdmin(supabase, tenantId)
    if (!acceso.ok) return acceso

    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan_type")
      .eq("id", tenantId)
      .maybeSingle()
    if (!tenant) return { ok: false, message: "Clínica no encontrada." }

    const { data: abiertos } = await supabase
      .from("saas_subscription_payments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("estado", "PENDIENTE")
      .limit(1)
    if ((abiertos ?? []).length > 0) {
      return {
        ok: false,
        message: "Ya tienes un pago en revisión. Nuestro equipo lo validará en breve.",
      }
    }

    const planType: PlanTenant = tenant.plan_type === "PRO" ? "PRO" : "CLINICA"
    const precioUsd = precioPlanUSD(planType)
    const tasaBCV = await getLatestBcvRate(supabase)
    const montoVes = redondear2(precioUsd * tasaBCV)

    const { data: creado, error } = await supabase
      .from("saas_subscription_payments")
      .insert({
        tenant_id: tenantId,
        plan_type: planType,
        monto_usd: precioUsd,
        monto_ves: montoVes,
        tasa_bcv: redondear2(tasaBCV),
        banco_origen: banco,
        referencia_pago: referencia,
        telefono_emisor: telefono,
        comprobante_url: comprobante,
        estado: "PENDIENTE",
      })
      .select("id")
      .maybeSingle()

    if (error) return { ok: false, message: error.message }
    if (!creado) {
      return { ok: false, message: "No se pudo registrar el pago. Intenta de nuevo." }
    }

    return {
      ok: true,
      data: { id: creado.id, montoVes, montoUsd: precioUsd },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Error al registrar el pago.",
    }
  }
}

