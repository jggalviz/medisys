"use server"

/**
 * MEDISYS · Métricas del Dashboard administrativo.
 *
 * Solo roles 'admin' o 'recepcion'. Los montos se estiman con el precio de
 * consulta del especialista (columna opcional `precio_consulta`); cuando la
 * cita tenga su propio campo de monto, usarlo en su lugar.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Appointment, Database, TenantUserRole } from "@/types/database"
import { createClient } from "@/lib/supabase/server"
import { getLatestBcvRate } from "@/lib/bcv"

export type DashboardKpis = {
  fecha: string
  totalCitas: number
  enCola: number
  atendidas: number
  canceladas: number
  /** Tasa BCV aplicada (Bs./USD) para la conversión. */
  tasaBCV: number
  /** Ingresos estimados del día en USD y en Bolívares (precio_consulta). */
  ingresos: {
    usd: number
    ves: number
  }
  recaudacion: {
    abonado: number
    porValidar: number
    pagoMovilEnLinea: number
    efectivoPresencial: number
  }
}

export type DashboardResult =
  | { ok: true; data: DashboardKpis }
  | { ok: false; message: string }

function siguienteDiaISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number)
  const date = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1, 12)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function toISOConOffset(dateISO: string, hora: string): string {
  return `${dateISO}T${hora}:00-04:00`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function autorizar(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ ok: boolean; message?: string }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false, message: "No autorizado: inicia sesión." }
  }

  const { data: member, error: memberError } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberError || !member) {
    return { ok: false, message: "No autorizado para esta clínica." }
  }
  const roles: TenantUserRole[] = ["admin", "recepcion"]
  if (!roles.includes(member.role)) {
    return {
      ok: false,
      message: "Se requiere rol admin o recepción.",
    }
  }
  return { ok: true }
}

/** Métricas del día actual (rango de `fecha_hora` del tenant). */
export async function getDashboardKpis(
  tenantId: string,
  dateISO: string
): Promise<DashboardResult> {
  try {
    if (!tenantId.trim() || !DATE_RE.test(dateISO)) {
      return { ok: false, message: "Parámetros inválidos." }
    }

    const supabase = await createClient()
    const acceso = await autorizar(supabase, tenantId)
    if (!acceso.ok) return { ok: false, message: acceso.message ?? "" }

    const { data: filas, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("fecha_hora", toISOConOffset(dateISO, "00:00"))
      .lt("fecha_hora", toISOConOffset(siguienteDiaISO(dateISO), "00:00"))

    if (error) return { ok: false, message: error.message }

    const citas = (filas ?? []) as unknown[]
    const doctorIds = Array.from(
      new Set(
        citas
          .map((c) => String((c as Record<string, unknown>).doctor_id ?? ""))
          .filter(Boolean)
      )
    )

    // Precios estimados por especialista.
    const precios = new Map<string, number>()
    if (doctorIds.length > 0) {
      const { data: doctores } = await supabase
        .from("doctors")
        .select("*")
        .in("id", doctorIds)
      for (const row of (doctores ?? []) as unknown[]) {
        const r = row as Record<string, unknown>
        const precio = Number(r.precio_consulta)
        precios.set(
          String(r.id ?? ""),
          Number.isFinite(precio) && precio > 0 ? precio : 0
        )
      }
    }

    const enCola = new Set([
      "pendiente",
      "pendiente_validacion",
      "pago_en_recepcion",
      "confirmada",
      "en_espera",
      "en_consulta",
    ])
    const atendidas = new Set(["atendido", "completada"])
    const canceladas = new Set(["cancelada", "expirada", "pago_rechazado"])

    const kpis: DashboardKpis = {
      fecha: dateISO,
      totalCitas: citas.length,
      enCola: 0,
      atendidas: 0,
      canceladas: 0,
      tasaBCV: 0,
      ingresos: { usd: 0, ves: 0 },
      recaudacion: {
        abonado: 0,
        porValidar: 0,
        pagoMovilEnLinea: 0,
        efectivoPresencial: 0,
      },
    }

    // Ingresos estimados del día sumando el precio de cada cita (en USD).
    let ingresosUSD = 0

    for (const fila of citas) {
      const cita = fila as Record<string, unknown>
      const estado = cita.estado as Appointment["estado"]
      const precio = precios.get(String(cita.doctor_id ?? "")) ?? 0
      const metodoCaja = cita.payment_method as
        | "efectivo"
        | "punto"
        | "pago_movil"
        | null
        | undefined

      ingresosUSD += precio

      if (enCola.has(estado)) kpis.enCola += 1
      if (atendidas.has(estado)) kpis.atendidas += 1
      if (canceladas.has(estado)) kpis.canceladas += 1

      // Abonado: pagos confirmados/validados o ya cobrados en caja.
      if (
        estado === "confirmada" ||
        estado === "en_espera" ||
        estado === "en_consulta" ||
        estado === "atendido" ||
        estado === "completada"
      ) {
        kpis.recaudacion.abonado += precio
      }

      // Por validar: pago móvil en línea sin revisar + cobro pendiente en caja.
      if (estado === "pendiente_validacion" || estado === "pago_en_recepcion") {
        kpis.recaudacion.porValidar += precio
      }
      if (estado === "pendiente_validacion") {
        kpis.recaudacion.pagoMovilEnLinea += precio
      }
      if (metodoCaja && metodoCaja !== "pago_movil") {
        kpis.recaudacion.efectivoPresencial += precio
      }
    }

    // Tasa oficial BCV + conversión USD → VES de los ingresos del día.
    const tasaBCV = await getLatestBcvRate(supabase)
    kpis.tasaBCV = tasaBCV
    kpis.ingresos.usd = ingresosUSD
    kpis.ingresos.ves = ingresosUSD * tasaBCV

    return { ok: true, data: kpis }
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Error al calcular métricas.",
    }
  }
}
