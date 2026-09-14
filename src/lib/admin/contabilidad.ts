/**
 * MEDISYS · Servicio contable (Módulo 3)
 * ---------------------------------------
 * Cierres/arqueos de caja (`daily_closings`) y liquidaciones de honorarios
 * (`doctor_settlements`). La aritmética vive en `src/lib/accounting-ve.ts`
 * (motor puro) para poder probarla de forma aislada.
 *
 * Ninguna función lanza: todas devuelven `AdminModuleResult`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult } from "@/types/admin"
import type {
  ArqueoCalculado,
  CierreCajaDTO,
  LiquidacionDTO,
  LiquidacionDetalleLinea,
  LiquidacionPreview,
  RespuestaCierre,
} from "@/types/accounting"
import type {
  DailyClosing,
  DailyClosingStatus,
  Database,
  DoctorSettlement,
  Payment,
  SettlementStatus,
} from "@/types/database"
import {
  aplicarConteo,
  calcularArqueo,
  liquidarHonorarios,
} from "@/lib/accounting-ve"
import { aPagoDTO, interpretarErrorFacturacion } from "@/lib/admin/facturas"
import { getTasaVigente } from "@/lib/currency-rates"
import { fechaHoyVenezuela } from "@/lib/date"
import { redondear2 } from "@/lib/fiscal-ve"
import type {
  ActualizarCierreInput,
  ActualizarLiquidacionInput,
  CierreCajaInput,
  CrearLiquidacionInput,
} from "@/lib/validations/accounting"
import {
  actualizarCierreSchema,
  actualizarLiquidacionSchema,
  cierreCajaSchema,
  cierresFiltrosSchema,
  crearLiquidacionSchema,
  liquidacionFiltrosSchema,
} from "@/lib/validations/accounting"

type Client = SupabaseClient<Database>

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function textoONull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

/** Fila de `daily_closings` → DTO. */
export function aCierreDTO(
  fila: DailyClosing,
  sedeNombre: string | null
): CierreCajaDTO {
  const breakdown = Array.isArray(fila.breakdown_by_method)
    ? fila.breakdown_by_method
    : []

  return {
    id: fila.id,
    tenantId: fila.tenant_id,
    sedeId: fila.sede_id,
    sedeNombre,
    closingDate: fila.closing_date,
    openedBy: fila.opened_by,
    closedBy: fila.closed_by,
    totalExpectedUSD: numero(fila.total_expected_usd),
    totalExpectedVES: numero(fila.total_expected_ves),
    totalActualUSD: numero(fila.total_actual_usd),
    totalActualVES: numero(fila.total_actual_ves),
    differenceUSD: numero(fila.difference_usd),
    differenceVES: numero(fila.difference_ves),
    breakdown: (breakdown as CierreCajaDTO["breakdown"]).map((item) => ({
      method: item.method,
      expectedUSD: numero(item.expectedUSD),
      expectedVES: numero(item.expectedVES),
      countedUSD: numero(item.countedUSD),
      countedVES: numero(item.countedVES),
      differenceUSD: numero(item.differenceUSD),
      differenceVES: numero(item.differenceVES),
      operaciones: numero(item.operaciones),
    })),
    status: fila.status as DailyClosingStatus,
    notes: textoONull(fila.notes),
    openedAt: fila.opened_at,
    closedAt: fila.closed_at,
    auditedAt: fila.audited_at,
    createdAt: fila.created_at,
  }
}

/** Fila de `doctor_settlements` → DTO. */
export function aLiquidacionDTO(
  fila: DoctorSettlement,
  doctorNombre: string
): LiquidacionDTO {
  return {
    id: fila.id,
    tenantId: fila.tenant_id,
    doctorId: fila.doctor_id,
    doctorNombre,
    periodStart: fila.period_start,
    periodEnd: fila.period_end,
    totalServicesCount: numero(fila.total_services_count),
    grossAmountUSD: numero(fila.gross_amount_usd),
    commissionDeductedUSD: numero(fila.commission_deducted_usd),
    netPayableUSD: numero(fila.net_payable_usd),
    netPayableVES: numero(fila.net_payable_ves),
    bcvRate: fila.bcv_rate_used === null ? null : numero(fila.bcv_rate_used),
    status: fila.status as SettlementStatus,
    paymentReference: textoONull(fila.payment_reference),
    notes: textoONull(fila.notes),
    approvedAt: fila.approved_at,
    paidAt: fila.paid_at,
    createdAt: fila.created_at,
  }
}

/* ------------------------------------------------------------------ */
/* Consultas auxiliares                                                */
/* ------------------------------------------------------------------ */

/** Nombres de sede por id (tolerante a instalaciones sin sedes). */
async function nombresDeSede(
  supabase: Client,
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)))
  const mapa = new Map<string, string>()
  if (unicos.length === 0) return mapa

  const { data } = await supabase
    .from("sedes")
    .select("id, nombre")
    .in("id", unicos)

  for (const sede of (data ?? []) as Array<{ id: string; nombre: string }>) {
    mapa.set(sede.id, sede.nombre)
  }
  return mapa
}

/** Nombres de especialista por id. */
async function nombresDeMedico(
  supabase: Client,
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unicos = Array.from(new Set(ids.filter(Boolean)))
  const mapa = new Map<string, string>()
  if (unicos.length === 0) return mapa

  const { data } = await supabase.from("doctors").select("*").in("id", unicos)

  for (const doctor of (data ?? []) as Array<
    Record<string, unknown> & { id: string }
  >) {
    const completo =
      [doctor.nombres, doctor.apellidos].filter(Boolean).join(" ").trim() ||
      textoONull(doctor.nombre) ||
      "Especialista"
    mapa.set(String(doctor.id), completo)
  }
  return mapa
}

/* ------------------------------------------------------------------ */
/* Cierres / arqueos de caja                                           */
/* ------------------------------------------------------------------ */

/** Cobros (verificados) de una jornada para una sede o para toda la clínica. */
async function pagosDelDia(
  supabase: Client,
  tenantId: string,
  opciones: { closingDate: string; sedeId: string | null }
): Promise<AdminModuleResult<Payment[]>> {
  const { closingDate, sedeId } = opciones

  try {
    let consulta = supabase
      .from("payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${closingDate}T00:00:00-04:00`)
      .lte("created_at", `${closingDate}T23:59:59-04:00`)

    if (sedeId) consulta = consulta.eq("sede_id", sedeId)

    const { data, error } = await consulta
    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    return { ok: true, data: (data ?? []) as Payment[] }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al leer los cobros del día.",
    }
  }
}

/** Calcula lo esperado por el sistema para la jornada (antes del conteo). */
export async function arqueoDelDia(
  supabase: Client,
  tenantId: string,
  opciones: { closingDate?: string | null; sedeId?: string | null } = {}
): Promise<AdminModuleResult<ArqueoCalculado>> {
  const closingDate = opciones.closingDate ?? fechaHoyVenezuela()
  const sedeId = opciones.sedeId ?? null

  const pagos = await pagosDelDia(supabase, tenantId, { closingDate, sedeId })
  if (!pagos.ok) return pagos

  const tasa = (await getTasaVigente(supabase)).rate
  return {
    ok: true,
    data: calcularArqueo({
      closingDate,
      pagos: pagos.data.map(aPagoDTO),
      tasa,
    }),
  }
}

/** Cierre registrado para la jornada/sede (o `null` si aún no se abrió). */
export async function obtenerCierreDelDia(
  supabase: Client,
  tenantId: string,
  opciones: { closingDate: string; sedeId: string | null }
): Promise<AdminModuleResult<CierreCajaDTO | null>> {
  const { closingDate, sedeId } = opciones

  try {
    const base = supabase
      .from("daily_closings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("closing_date", closingDate)

    const { data, error } = await (sedeId
      ? base.eq("sede_id", sedeId)
      : base.is("sede_id", null)
    ).maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) return { ok: true, data: null }

    const fila = data as DailyClosing
    const nombres = await nombresDeSede(supabase, [fila.sede_id ?? ""])
    return {
      ok: true,
      data: aCierreDTO(fila, fila.sede_id ? nombres.get(fila.sede_id) ?? null : null),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al consultar el cierre del día.",
    }
  }
}

/**
 * Guarda el cuadre de la jornada: recalcula lo esperado por el sistema, aplica
 * el conteo físico del cajero y persiste cierre + desglose + diferencias.
 *
 * - Sin `closingId` se reutiliza el cierre del día si existe (o se crea).
 * - `finalizar = true` marca el cierre como CLOSED y guarda quién lo cerró.
 */
export async function guardarCierre(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  entrada: unknown
): Promise<AdminModuleResult<RespuestaCierre>> {
  const valido = cierreCajaSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const datos: CierreCajaInput = valido.data

  const arqueo = await arqueoDelDia(supabase, tenantId, {
    closingDate: datos.closingDate,
    sedeId: datos.sedeId,
  })
  if (!arqueo.ok) return arqueo

  const conteo = aplicarConteo(arqueo.data.breakdown, datos.conteo)
  const ahora = new Date().toISOString()

  try {
    // Cierre existente: por id explícito o por la clave única del día/sede.
    let existente: DailyClosing | null = null

    if (datos.closingId) {
      const { data, error } = await supabase
        .from("daily_closings")
        .select("*")
        .eq("id", datos.closingId)
        .eq("tenant_id", tenantId)
        .maybeSingle()
      if (error) {
        const info = interpretarErrorFacturacion(error)
        return { ok: false, code: info.code, message: info.message }
      }
      existente = (data as DailyClosing | null) ?? null
    } else {
      const base = supabase
        .from("daily_closings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("closing_date", datos.closingDate)
      const { data, error } = await (datos.sedeId
        ? base.eq("sede_id", datos.sedeId)
        : base.is("sede_id", null)
      ).maybeSingle()

      if (error) {
        const info = interpretarErrorFacturacion(error)
        return { ok: false, code: info.code, message: info.message }
      }
      existente = (data as DailyClosing | null) ?? null
    }

    if (existente && existente.status === "AUDITED") {
      return {
        ok: false,
        code: "CONFLICT",
        message:
          "El cierre ya fue auditado: no se puede modificar el arqueo de esa jornada.",
      }
    }

    const payload = {
      tenant_id: tenantId,
      sede_id: datos.sedeId,
      closing_date: datos.closingDate,
      total_expected_usd: arqueo.data.esperadoUSD,
      total_expected_ves: arqueo.data.esperadoVES,
      total_actual_usd: conteo.contadoUSD,
      total_actual_ves: conteo.contadoVES,
      difference_usd: conteo.differenceUSD,
      difference_ves: conteo.differenceVES,
      breakdown_by_method: conteo.breakdown,
      status: (datos.finalizar ? "CLOSED" : "OPEN") as DailyClosingStatus,
      notes: datos.notes,
      closed_by: datos.finalizar ? usuarioId : null,
      closed_at: datos.finalizar ? ahora : null,
    }

    const guardado = existente
      ? await supabase
          .from("daily_closings")
          .update({
            ...payload,
            closed_by: datos.finalizar
              ? usuarioId
              : existente.closed_by,
            closed_at: datos.finalizar ? ahora : existente.closed_at,
          })
          .eq("id", existente.id)
          .select("*")
          .maybeSingle()
      : await supabase
          .from("daily_closings")
          .insert({ ...payload, opened_by: usuarioId })
          .select("*")
          .maybeSingle()

    if (guardado.error) {
      const info = interpretarErrorFacturacion(guardado.error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!guardado.data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "El cierre de caja no se guardó: tu usuario no tiene permisos de caja en esta clínica.",
      }
    }

    const fila = guardado.data as DailyClosing
    const nombres = await nombresDeSede(supabase, [fila.sede_id ?? ""])

    return {
      ok: true,
      data: {
        cierre: aCierreDTO(
          fila,
          fila.sede_id ? nombres.get(fila.sede_id) ?? null : null
        ),
        arqueo: arqueo.data,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al guardar el cierre de caja.",
    }
  }
}

/** Histórico de cierres/arqueos con filtros por sede, estado y fechas. */
export async function listarCierres(
  supabase: Client,
  tenantId: string,
  filtros: {
    sedeId?: string | null
    status?: DailyClosingStatus | "TODOS" | null
    desde?: string | null
    hasta?: string | null
    limite?: number
  } = {}
): Promise<AdminModuleResult<CierreCajaDTO[]>> {
  const valido = cierresFiltrosSchema.safeParse(filtros)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const f = valido.data

  try {
    let consulta = supabase
      .from("daily_closings")
      .select("*")
      .eq("tenant_id", tenantId)

    if (f.sedeId) consulta = consulta.eq("sede_id", f.sedeId)
    if (f.status !== "TODOS") consulta = consulta.eq("status", f.status)
    if (f.desde) consulta = consulta.gte("closing_date", f.desde)
    if (f.hasta) consulta = consulta.lte("closing_date", f.hasta)

    const { data, error } = await consulta
      .order("closing_date", { ascending: false })
      .limit(f.limite)

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }

    const filas = (data ?? []) as DailyClosing[]
    const nombres = await nombresDeSede(
      supabase,
      filas.map((fila) => fila.sede_id ?? "")
    )

    return {
      ok: true,
      data: filas.map((fila) =>
        aCierreDTO(fila, fila.sede_id ? nombres.get(fila.sede_id) ?? null : null)
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar los cierres de caja.",
    }
  }
}

/**
 * Actualiza el estado de un cierre:
 *  - `cerrar`: pasa OPEN → CLOSED (guardando quién cerró).
 *  - `auditar`: pasa CLOSED → AUDITED (rol de contabilidad).
 *  - `notas`: solo actualiza la nota interna.
 */
export async function actualizarCierre(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  cierreId: string,
  entrada: unknown
): Promise<AdminModuleResult<CierreCajaDTO>> {
  const valido = actualizarCierreSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const datos: ActualizarCierreInput = valido.data

  try {
    const { data, error } = await supabase
      .from("daily_closings")
      .select("*")
      .eq("id", cierreId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "El cierre de caja no existe en esta clínica.",
      }
    }

    const actual = data as DailyClosing
    const ahora = new Date().toISOString()

    const cambios: {
      status?: DailyClosingStatus
      closed_by?: string | null
      closed_at?: string | null
      audited_by?: string | null
      audited_at?: string | null
      notes?: string | null
    } = { notes: datos.notes ?? actual.notes }

    if (datos.accion === "cerrar") {
      if (actual.status === "AUDITED") {
        return {
          ok: false,
          code: "CONFLICT",
          message: "El cierre ya está auditado y no puede reabrirse.",
        }
      }
      cambios.status = "CLOSED"
      cambios.closed_by = usuarioId
      cambios.closed_at = actual.closed_at ?? ahora
    }

    if (datos.accion === "auditar") {
      if (actual.status === "OPEN") {
        return {
          ok: false,
          code: "CONFLICT",
          message: "Cierra la caja del día antes de auditar el arqueo.",
        }
      }
      cambios.status = "AUDITED"
      cambios.audited_by = usuarioId
      cambios.audited_at = ahora
    }

    const actualizado = await supabase
      .from("daily_closings")
      .update(cambios)
      .eq("id", actual.id)
      .select("*")
      .maybeSingle()

    if (actualizado.error) {
      const info = interpretarErrorFacturacion(actualizado.error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!actualizado.data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "No tienes permisos para actualizar este cierre de caja.",
      }
    }

    const fila = actualizado.data as DailyClosing
    const nombres = await nombresDeSede(supabase, [fila.sede_id ?? ""])
    return {
      ok: true,
      data: aCierreDTO(
        fila,
        fila.sede_id ? nombres.get(fila.sede_id) ?? null : null
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al actualizar el cierre de caja.",
    }
  }
}

/* ------------------------------------------------------------------ */
/* Liquidaciones de honorarios                                         */
/* ------------------------------------------------------------------ */

/**
 * Calcula la liquidación de un especialista para un período: toma las líneas
 * facturadas en facturas **cobradas** (`status = PAID`) y aplica el honorario
 * ya pactado en cada línea (`invoice_items.doctor_commission_amount`).
 *
 * NOTA: las facturas parcialmente cobradas no se liquidan todavía; quedan
 * disponibles en el siguiente período.
 */
export async function calcularLiquidacion(
  supabase: Client,
  tenantId: string,
  opciones: {
    doctorId: string
    periodStart: string
    periodEnd: string
    tasa?: number | null
  }
): Promise<AdminModuleResult<LiquidacionPreview>> {
  const { doctorId, periodStart, periodEnd } = opciones

  try {
    const { data: facturas, error: errorFacturas } = await supabase
      .from("invoices")
      .select("id, invoice_number, created_at, status, payment_status")
      .eq("tenant_id", tenantId)
      .eq("status", "PAID")
      .gte("created_at", `${periodStart}T00:00:00-04:00`)
      .lte("created_at", `${periodEnd}T23:59:59-04:00`)

    if (errorFacturas) {
      const info = interpretarErrorFacturacion(errorFacturas)
      return { ok: false, code: info.code, message: info.message }
    }

    const facturasCobradas = (facturas ?? []) as Array<{
      id: string
      invoice_number: string | null
      created_at: string
      status: string
      payment_status: string
    }>

    if (facturasCobradas.length === 0) {
      return {
        ok: true,
        data: {
          doctorId,
          doctorNombre: "",
          periodStart,
          periodEnd,
          totalServicesCount: 0,
          grossAmountUSD: 0,
          commissionDeductedUSD: 0,
          netPayableUSD: 0,
          netPayableVES: 0,
          tasa: opciones.tasa ?? 0,
          facturasConsideradas: 0,
          detalle: [],
        },
      }
    }

    const ids = facturasCobradas.map((factura) => factura.id)
    const { data: items, error: errorItems } = await supabase
      .from("invoice_items")
      .select("*")
      .in("invoice_id", ids)
      .eq("doctor_id", doctorId)

    if (errorItems) {
      const info = interpretarErrorFacturacion(errorItems)
      return { ok: false, code: info.code, message: info.message }
    }

    // Tipo de honorario por servicio (informativo en el detalle).
    const idsServicio = Array.from(
      new Set(
        (items ?? [])
          .map((item) => item.service_id)
          .filter((id): id is string => Boolean(id))
      )
    )
    const tiposHonorario = new Map<string, "PERCENTAGE" | "FIXED">()
    if (idsServicio.length > 0) {
      const { data: servicios } = await supabase
        .from("medical_services")
        .select("id, doctor_commission_type")
        .in("id", idsServicio)
      for (const servicio of (servicios ?? []) as Array<{
        id: string
        doctor_commission_type: string
      }>) {
        tiposHonorario.set(
          servicio.id,
          servicio.doctor_commission_type === "FIXED" ? "FIXED" : "PERCENTAGE"
        )
      }
    }

    const porFactura = new Map(facturasCobradas.map((f) => [f.id, f]))

    const lineas: LiquidacionDetalleLinea[] = (items ?? []).map((item) => {
      const factura = porFactura.get(item.invoice_id)
      const grossUSD = redondear2(
        numero(item.unit_price_usd) * numero(item.quantity)
      )
      const netUSD = redondear2(Math.min(numero(item.doctor_commission_amount), grossUSD))

      return {
        invoiceId: item.invoice_id,
        invoiceNumber: factura?.invoice_number ?? null,
        fecha: (factura?.created_at ?? new Date().toISOString()).slice(0, 10),
        description: String(item.description ?? "Servicio"),
        quantity: numero(item.quantity) || 1,
        grossUSD,
        commissionUSD: redondear2(grossUSD - netUSD),
        netUSD,
        tipoHonorario: item.service_id
          ? tiposHonorario.get(item.service_id) ?? null
          : null,
      }
    })

    const tasa = opciones.tasa ?? (await getTasaVigente(supabase)).rate
    const nombres = await nombresDeMedico(supabase, [doctorId])

    const preview = liquidarHonorarios({
      doctorId,
      doctorNombre: nombres.get(doctorId) ?? "Especialista",
      periodStart,
      periodEnd,
      tasa,
      lineas,
    })

    return { ok: true, data: preview }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al calcular la liquidación.",
    }
  }
}

/**
 * Genera (y opcionalmente aprueba) la liquidación del período. Solo se guarda
 * si hay servicios cobrados: evita liquidaciones en cero.
 */
export async function generarLiquidacion(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  entrada: unknown
): Promise<AdminModuleResult<LiquidacionDTO>> {
  const valido = crearLiquidacionSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const datos: CrearLiquidacionInput = valido.data

  const preview = await calcularLiquidacion(supabase, tenantId, {
    doctorId: datos.doctorId,
    periodStart: datos.periodStart,
    periodEnd: datos.periodEnd,
    tasa: datos.bcvRate,
  })
  if (!preview.ok) return preview

  if (preview.data.totalServicesCount === 0 || preview.data.grossAmountUSD <= 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message:
        "No hay servicios facturados y cobrados para ese especialista en el período seleccionado.",
    }
  }

  const ahora = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from("doctor_settlements")
      .insert({
        tenant_id: tenantId,
        doctor_id: datos.doctorId,
        period_start: datos.periodStart,
        period_end: datos.periodEnd,
        total_services_count: preview.data.totalServicesCount,
        gross_amount_usd: preview.data.grossAmountUSD,
        commission_deducted_usd: preview.data.commissionDeductedUSD,
        net_payable_usd: preview.data.netPayableUSD,
        net_payable_ves: preview.data.netPayableVES,
        bcv_rate_used: preview.data.tasa > 0 ? preview.data.tasa : null,
        status: datos.aprobar ? "APPROVED" : "PENDING",
        notes: datos.notes,
        created_by: usuarioId,
        approved_by: datos.aprobar ? usuarioId : null,
        approved_at: datos.aprobar ? ahora : null,
      })
      .select("*")
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "La liquidación no se guardó: solo administración y contabilidad pueden generarlas.",
      }
    }

    return {
      ok: true,
      data: aLiquidacionDTO(data as DoctorSettlement, preview.data.doctorNombre),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al generar la liquidación.",
    }
  }
}

/** Lista las liquidaciones del tenant con filtros por médico/estado/fechas. */
export async function listarLiquidaciones(
  supabase: Client,
  tenantId: string,
  filtros: {
    doctorId?: string | null
    status?: SettlementStatus | "TODOS" | null
    desde?: string | null
    hasta?: string | null
    limite?: number
  } = {}
): Promise<AdminModuleResult<LiquidacionDTO[]>> {
  const valido = liquidacionFiltrosSchema.safeParse(filtros)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const f = valido.data

  try {
    let consulta = supabase
      .from("doctor_settlements")
      .select("*")
      .eq("tenant_id", tenantId)

    if (f.doctorId) consulta = consulta.eq("doctor_id", f.doctorId)
    if (f.status !== "TODOS") consulta = consulta.eq("status", f.status)
    if (f.desde) consulta = consulta.gte("period_start", f.desde)
    if (f.hasta) consulta = consulta.lte("period_end", f.hasta)

    const { data, error } = await consulta
      .order("period_end", { ascending: false })
      .limit(f.limite)

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }

    const filas = (data ?? []) as DoctorSettlement[]
    const nombres = await nombresDeMedico(
      supabase,
      filas.map((fila) => fila.doctor_id)
    )

    return {
      ok: true,
      data: filas.map((fila) =>
        aLiquidacionDTO(fila, nombres.get(fila.doctor_id) ?? "Especialista")
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar las liquidaciones.",
    }
  }
}

/**
 * Cambia el estado de una liquidación:
 *  - `aprobar`: PENDING → APPROVED.
 *  - `pagar`: PENDING/APPROVED → PAID (exige referencia de pago).
 *  - `notas`: solo actualiza la nota interna.
 */
export async function actualizarLiquidacion(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  liquidacionId: string,
  entrada: unknown
): Promise<AdminModuleResult<LiquidacionDTO>> {
  const valido = actualizarLiquidacionSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const datos: ActualizarLiquidacionInput = valido.data

  try {
    const { data, error } = await supabase
      .from("doctor_settlements")
      .select("*")
      .eq("id", liquidacionId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La liquidación no existe en esta clínica.",
      }
    }

    const actual = data as DoctorSettlement
    const ahora = new Date().toISOString()

    const cambios: {
      status?: SettlementStatus
      payment_reference?: string | null
      approved_by?: string | null
      approved_at?: string | null
      paid_by?: string | null
      paid_at?: string | null
      notes?: string | null
    } = { notes: datos.notes ?? actual.notes }

    if (datos.accion === "aprobar") {
      if (actual.status === "PAID") {
        return {
          ok: false,
          code: "CONFLICT",
          message: "La liquidación ya fue pagada: no se puede volver a aprobar.",
        }
      }
      cambios.status = "APPROVED"
      cambios.approved_by = actual.approved_by ?? usuarioId
      cambios.approved_at = actual.approved_at ?? ahora
    }

    if (datos.accion === "pagar") {
      cambios.status = "PAID"
      cambios.payment_reference = datos.paymentReference
      cambios.paid_by = usuarioId
      cambios.paid_at = ahora
      // Si se paga directo desde PENDING, se registra también la aprobación.
      cambios.approved_by = actual.approved_by ?? usuarioId
      cambios.approved_at = actual.approved_at ?? ahora
    }

    const actualizado = await supabase
      .from("doctor_settlements")
      .update(cambios)
      .eq("id", actual.id)
      .select("*")
      .maybeSingle()

    if (actualizado.error) {
      const info = interpretarErrorFacturacion(actualizado.error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!actualizado.data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "No tienes permisos para modificar esta liquidación (solo administración y contabilidad).",
      }
    }

    const fila = actualizado.data as DoctorSettlement
    const nombres = await nombresDeMedico(supabase, [fila.doctor_id])

    return {
      ok: true,
      data: aLiquidacionDTO(
        fila,
        nombres.get(fila.doctor_id) ?? "Especialista"
      ),
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al actualizar la liquidación.",
    }
  }
}
