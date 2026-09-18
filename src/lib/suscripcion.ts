/**
 * MEDISYS · Suscripciones del SaaS (planes, vencimiento y datos de cobro).
 *
 * Este módulo es PURO (sin imports de servidor) para poder usarse tanto en
 * Server Components/Actions como en componentes cliente.
 *
 * Catálogo comercial (espejo de la landing `/`, sección "Precios"):
 *   INDIVIDUAL → 1 especialista · $10 USD/mes ($100/año)
 *   PYME       → 2 a 10 especialistas · $40 USD/mes ($400/año)
 *   PRO        → 10+ especialistas o multi-sede · $80 USD/mes ($800/año)
 * El pago anual equivale a 10 meses (ahorro de 2 meses) en los 3 planes.
 */
import type { PlanTenant } from "@/types/database"

/** Planes comerciales vigentes (orden de la UI). */
export const PLANES_TENANT: readonly PlanTenant[] = [
  "INDIVIDUAL",
  "PYME",
  "PRO",
]

/** Precio mensual en USD por plan. */
export const PRECIO_PLAN_USD: Record<PlanTenant, number> = {
  INDIVIDUAL: 10,
  PYME: 40,
  PRO: 80,
}

/** Precio anual en USD por plan (10 meses: ahorro de 2 meses). */
export const PRECIO_PLAN_ANUAL_USD: Record<PlanTenant, number> = {
  INDIVIDUAL: 100,
  PYME: 400,
  PRO: 800,
}

/** Meses de ahorro del pago anual frente al mensual. */
export const MESES_AHORRO_ANUAL = 2

/** Etiqueta legible del plan. */
export const ETIQUETA_PLAN: Record<PlanTenant, string> = {
  INDIVIDUAL: "Plan Individual",
  PYME: "Plan PyME",
  PRO: "Plan PRO",
}

/**
 * Cupo de especialistas por plan (`max: null` → sin tope fijo, lo administra el
 * Super Admin por cliente).
 */
export const LIMITE_ESPECIALISTAS_PLAN: Record<
  PlanTenant,
  { min: number; max: number | null }
> = {
  INDIVIDUAL: { min: 1, max: 1 },
  PYME: { min: 1, max: 10 },
  PRO: { min: 11, max: null },
}

/** Días que suma cada renovación aprobada. */
export const DIAS_RENOVACION = 30

/** Días de antelación con los que se avisa del vencimiento. */
export const DIAS_AVISO_VENCIMIENTO = 5

/**
 * Normaliza el `plan_type` almacenado, tolerante a valores heredados de las
 * migraciones 0009/0010 (`PRO` = 1 especialista, `CLINICA`) y a los valores que
 * quedaron en bases creadas a mano (`independiente`, `multi_especialista`).
 *
 * Reglas (idénticas a la migración 0020):
 *   - `PRO` + cupo 1  → INDIVIDUAL (el `PRO` histórico era "Médico Pro").
 *   - `independiente` → INDIVIDUAL.
 *   - `CLINICA` / `multi_especialista` → PRO si el cupo es 10+, si no PYME.
 *   - Desconocido → PYME (tier intermedio: nunca sobrecobra al cliente).
 *
 * `maxEspecialistas` acepta el valor crudo de la BD (texto, number o null).
 */
export function normalizarPlan(
  valor: unknown,
  maxEspecialistas?: unknown
): PlanTenant {
  const v = String(valor ?? "").trim().toUpperCase()
  const cupo = Number(maxEspecialistas)

  if (v === "INDIVIDUAL" || v === "INDEPENDIENTE") return "INDIVIDUAL"
  if (v === "PYME") return "PYME"
  if (v === "PRO") {
    // Solo es heredado si sabemos que el cupo era 1 (el `PRO` de 0009 era
    // "Médico Pro" = 1 especialista). Sin cupo se asume el tier PRO actual.
    const cupoConocido = maxEspecialistas != null && Number.isFinite(cupo)
    return cupoConocido && cupo <= 1 ? "INDIVIDUAL" : "PRO"
  }
  if (v === "CLINICA" || v === "MULTI_ESPECIALISTA") {
    return Number.isFinite(cupo) && cupo > 10 ? "PRO" : "PYME"
  }
  return "PYME"
}

/** Etiqueta legible del plan (acepta valores heredados o desconocidos). */
export function nombrePlan(
  plan: unknown,
  maxEspecialistas?: unknown
): string {
  return ETIQUETA_PLAN[normalizarPlan(plan, maxEspecialistas)]
}

/** Precio mensual (USD) del plan; por defecto el de PyME. */
export function precioPlanUSD(
  plan: unknown,
  maxEspecialistas?: unknown
): number {
  return PRECIO_PLAN_USD[normalizarPlan(plan, maxEspecialistas)]
}

/** Precio anual (USD) del plan; por defecto el de PyME. */
export function precioPlanAnualUSD(
  plan: unknown,
  maxEspecialistas?: unknown
): number {
  return PRECIO_PLAN_ANUAL_USD[normalizarPlan(plan, maxEspecialistas)]
}

/**
 * `true` si el plan usa el flujo de especialista único (asignación automática
 * en la reserva y 1 solo especialista permitido).
 */
export function esPlanIndividual(
  plan: unknown,
  maxEspecialistas?: unknown
): boolean {
  return normalizarPlan(plan, maxEspecialistas) === "INDIVIDUAL"
}

/**
 * Ajusta un cupo de especialistas al rango del plan:
 * INDIVIDUAL → 1 (fijo) · PYME → 1..10 · PRO → mínimo 11 (sin tope).
 */
export function ajustarMaxEspecialistas(
  plan: PlanTenant,
  valor: unknown
): number {
  const limite = LIMITE_ESPECIALISTAS_PLAN[plan]
  const n = Math.floor(Number(valor))
  const base = Number.isFinite(n) && n > 0 ? n : limite.min
  const conMinimo = Math.max(limite.min, base)
  return limite.max === null ? conMinimo : Math.min(limite.max, conMinimo)
}

/** Descripción del cupo permitido por plan (mensajes de validación). */
export function rangoEspecialistasPlan(plan: PlanTenant): string {
  const { min, max } = LIMITE_ESPECIALISTAS_PLAN[plan]
  if (max === null) return `un mínimo de ${min} especialistas`
  if (max === min) return `${min} especialista${min === 1 ? "" : "s"} (fijo)`
  return `entre ${min} y ${max} especialistas`
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
