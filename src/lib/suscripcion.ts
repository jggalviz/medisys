/**
 * MEDISYS · Suscripciones del SaaS (planes, vencimiento y datos de cobro).
 *
 * Este módulo es PURO (sin imports de servidor) para poder usarse tanto en
 * Server Components/Actions como en componentes cliente.
 */
import type { PlanTenant } from "@/types/database"

/** Precio mensual en USD por plan. */
export const PRECIO_PLAN_USD: Record<PlanTenant, number> = {
  PRO: 30,
  CLINICA: 100,
}

/** Días que suma cada renovación aprobada. */
export const DIAS_RENOVACION = 30

/** Días de antelación con los que se avisa del vencimiento. */
export const DIAS_AVISO_VENCIMIENTO = 5

/** Etiqueta legible del plan. */
export function nombrePlan(plan: PlanTenant | null | undefined): string {
  return plan === "PRO" ? "Plan PRO" : "Plan Clínica"
}

/** Precio mensual (USD) del plan; por defecto el de Clínica. */
export function precioPlanUSD(plan: PlanTenant | null | undefined): number {
  return plan === "PRO" ? PRECIO_PLAN_USD.PRO : PRECIO_PLAN_USD.CLINICA
}

/** Datos oficiales de Pago Móvil del SaaS (configurables por entorno). */
export function datosPagoMovilSaas(): {
  banco: string
  cedula: string
  telefono: string
  titular: string
} {
  return {
    banco: process.env.SAAS_PAGO_MOVIL_BANCO || "Banesco (0134)",
    cedula: process.env.SAAS_PAGO_MOVIL_CEDULA || "J-40555123-7",
    telefono: process.env.SAAS_PAGO_MOVIL_TELEFONO || "0414-1234567",
    titular: process.env.SAAS_PAGO_MOVIL_TITULAR || "Medisys C.A.",
  }
}

/**
 * Días (con signo) que faltan para el vencimiento. `null` si no hay fecha.
 * Negativo → ya venció.
 */
export function diasHastaVencimiento(
  venceISO: string | null | undefined
): number | null {
  if (!venceISO) return null
  const vence = new Date(venceISO).getTime()
  if (!Number.isFinite(vence)) return null
  return Math.ceil((vence - Date.now()) / 86_400_000)
}

export type EstadoMembresia = {
  /** Hay fecha de vencimiento registrada. */
  tieneFecha: boolean
  /** Días restantes (negativo si venció). */
  dias: number
  /** La membresía ya venció. */
  vencida: boolean
  /** Debe mostrarse el aviso (vencida o a ≤ 5 días). */
  debeAvisar: boolean
}

/** Evalúa el estado de la membresía para el banner del panel. */
export function evaluarMembresia(
  venceISO: string | null | undefined
): EstadoMembresia {
  const dias = diasHastaVencimiento(venceISO)
  if (dias === null) {
    return { tieneFecha: false, dias: 0, vencida: false, debeAvisar: false }
  }
  const vencida = dias <= 0
  return {
    tieneFecha: true,
    dias,
    vencida,
    debeAvisar: vencida || dias <= DIAS_AVISO_VENCIMIENTO,
  }
}

/** Formatea la fecha de vencimiento como '2 de septiembre de 2026'. */
export function formatearVencimiento(venceISO: string | null | undefined): string {
  if (!venceISO) return "sin fecha"
  const date = new Date(venceISO)
  if (Number.isNaN(date.getTime())) return "sin fecha"
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}
