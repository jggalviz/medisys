/**
 * MEDISYS · Validaciones del Módulo 3 (Contabilidad y cuadre de caja)
 * -------------------------------------------------------------------
 * Esquemas de entrada para:
 *   1. Filtros del Libro de Ventas SENIAT (año/mes/sede/formato).
 *   2. Apertura, cuadre y auditoría del cierre de caja (`daily_closings`).
 *   3. Generación y estado de liquidaciones de honorarios
 *      (`doctor_settlements`).
 *
 * Reutiliza las primitivas de `./core` (misma API que Zod) para mantener la
 * consistencia con los módulos de administración y facturación.
 */
import type {
  DailyClosingStatus,
  PaymentMethod,
  SettlementStatus,
} from "@/types/database"
import { METODOS_COBRO } from "@/lib/billing-ve"
import type { Contexto } from "./core"
import {
  booleano,
  comoArreglo,
  comoObjeto,
  crearEsquema,
  decimalRequerido,
  enumerado,
  enteroRequerido,
  error,
  fechaRequerida,
  textoOpcional,
  uuidOpcional,
} from "./core"

/* ------------------------------------------------------------------ */
/* 1. Libro de Ventas SENIAT                                          */
/* ------------------------------------------------------------------ */

export const FORMATOS_EXPORTACION = ["json", "csv"] as const
export type FormatoLibro = (typeof FORMATOS_EXPORTACION)[number]

export type LibroVentasFiltrosInput = {
  anio: number
  mes: number
  sedeId: string | null
  formato: FormatoLibro
}

export const libroVentasFiltrosSchema =
  crearEsquema<LibroVentasFiltrosInput>((entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const anio = enteroRequerido(ctx, "anio", "El año", datos.anio, {
      min: 2000,
      max: 2100,
    })
    const mes = enteroRequerido(ctx, "mes", "El mes", datos.mes, {
      min: 1,
      max: 12,
    })
    const sedeId = uuidOpcional(ctx, "sedeId", "La sede", datos.sedeId)
    const formato = enumerado<FormatoLibro>(
      ctx,
      "formato",
      "El formato",
      datos.formato,
      FORMATOS_EXPORTACION,
      "json"
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { anio, mes, sedeId, formato } }
  })

/* ------------------------------------------------------------------ */
/* 2. Cierre / arqueo de caja                                          */
/* ------------------------------------------------------------------ */

/** Conteo físico reportado por la caja para un método de cobro. */
export type ConteoMetodoInput = {
  method: PaymentMethod
  countedUSD: number
  countedVES: number
}

export const conteoMetodoSchema = crearEsquema<ConteoMetodoInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const method = enumerado<PaymentMethod>(
    ctx,
    "method",
    "El método de cobro",
    datos.method,
    METODOS_COBRO,
    null
  )
  const countedUSD = decimalRequerido(
    ctx,
    "countedUSD",
    "El monto contado en USD",
    datos.countedUSD ?? 0,
    { min: 0, max: 10_000_000 }
  )
  const countedVES = decimalRequerido(
    ctx,
    "countedVES",
    "El monto contado en Bs.",
    datos.countedVES ?? 0,
    { min: 0, max: 10_000_000_000 }
  )

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
  return { success: true, data: { method, countedUSD, countedVES } }
})

export type CierreCajaInput = {
  /** Cierre existente que se va a cuadrar (null = se abre/cierra uno nuevo). */
  closingId: string | null
  sedeId: string | null
  /** 'YYYY-MM-DD' de la jornada; vacío = hoy en Venezuela. */
  closingDate: string
  /** true → el envío cierra el arqueo; false → solo guarda el avance. */
  finalizar: boolean
  /** Conteo físico por método de cobro. */
  conteo: ConteoMetodoInput[]
  notes: string | null
}

export const cierreCajaSchema = crearEsquema<CierreCajaInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const closingId = uuidOpcional(ctx, "closingId", "El cierre", datos.closingId)
  const sedeId = uuidOpcional(ctx, "sedeId", "La sede", datos.sedeId)
  const closingDate = fechaRequerida(
    ctx,
    "closingDate",
    "La fecha del cuadre",
    datos.closingDate
  )
  const finalizar = booleano(datos.finalizar, true)
  const notes = textoOpcional(ctx, "notes", "La nota", datos.notes, {
    max: 500,
  })

  const conteoBruto = comoArreglo(datos.conteo)
  const conteo: ConteoMetodoInput[] = []
  conteoBruto.forEach((fila, indice) => {
    const valido = conteoMetodoSchema.safeParse(fila)
    if (!valido.success) {
      ctx.issues.push(
        ...valido.error.issues.map((issue) => ({
          campo: `conteo[${indice}].${issue.campo}`,
          mensaje: issue.mensaje,
        }))
      )
      return
    }
    // Un método puede repetirse: se consolida el conteo reportado.
    const existente = conteo.findIndex(
      (item) => item.method === valido.data.method
    )
    if (existente >= 0) {
      conteo[existente] = {
        method: valido.data.method,
        countedUSD: conteo[existente].countedUSD + valido.data.countedUSD,
        countedVES: conteo[existente].countedVES + valido.data.countedVES,
      }
      return
    }
    conteo.push(valido.data)
  })

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
  return {
    success: true,
    data: { closingId, sedeId, closingDate, finalizar, conteo, notes },
  }
})

export const ACCIONES_CIERRE = ["cerrar", "auditar", "notas"] as const
export type AccionCierre = (typeof ACCIONES_CIERRE)[number]

export type ActualizarCierreInput = {
  accion: AccionCierre
  notes: string | null
}

export const actualizarCierreSchema = crearEsquema<ActualizarCierreInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const accion = enumerado<AccionCierre>(
      ctx,
      "accion",
      "La acción",
      datos.accion,
      ACCIONES_CIERRE,
      null
    )
    const notes = textoOpcional(ctx, "notes", "La nota", datos.notes, {
      max: 500,
    })

    if (accion === "notas" && !notes) {
      ctx.issues.push({
        campo: "notes",
        mensaje: "Escribe la nota del cierre para guardarla.",
      })
    }

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { accion, notes } }
  }
)

/** Estados posibles del cierre (para filtros y UI). */
export const ESTADOS_CIERRE: readonly DailyClosingStatus[] = [
  "OPEN",
  "CLOSED",
  "AUDITED",
]

export type CierresFiltrosInput = {
  sedeId: string | null
  status: DailyClosingStatus | "TODOS"
  desde: string | null
  hasta: string | null
  limite: number
}

export const cierresFiltrosSchema = crearEsquema<CierresFiltrosInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const sedeId = uuidOpcional(ctx, "sedeId", "La sede", datos.sedeId)
    const status = enumerado<DailyClosingStatus | "TODOS">(
      ctx,
      "status",
      "El estado",
      datos.status,
      [...ESTADOS_CIERRE, "TODOS"],
      "TODOS"
    )
    const desde = fechaFiltro(ctx, "desde", "La fecha inicial", datos.desde)
    const hasta = fechaFiltro(ctx, "hasta", "La fecha final", datos.hasta)
    if (desde && hasta && desde > hasta) {
      ctx.issues.push({
        campo: "hasta",
        mensaje: "La fecha final no puede ser anterior a la inicial.",
      })
    }
    const limite = enteroRequerido(
      ctx,
      "limite",
      "El límite",
      datos.limite ?? 60,
      { min: 1, max: 365 }
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { sedeId, status, desde, hasta, limite } }
  }
)

/* ------------------------------------------------------------------ */
/* 3. Liquidaciones de honorarios                                      */
/* ------------------------------------------------------------------ */

/** Estados posibles de una liquidación (para filtros y UI). */
export const ESTADOS_LIQUIDACION: readonly SettlementStatus[] = [
  "PENDING",
  "APPROVED",
  "PAID",
]

export type LiquidacionFiltrosInput = {
  doctorId: string | null
  status: SettlementStatus | "TODOS"
  desde: string | null
  hasta: string | null
  limite: number
}

export const liquidacionFiltrosSchema = crearEsquema<LiquidacionFiltrosInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const doctorId = uuidOpcional(
      ctx,
      "doctorId",
      "El especialista",
      datos.doctorId
    )
    const status = enumerado<SettlementStatus | "TODOS">(
      ctx,
      "status",
      "El estado",
      datos.status,
      [...ESTADOS_LIQUIDACION, "TODOS"],
      "TODOS"
    )
    const desde = fechaFiltro(ctx, "desde", "La fecha inicial", datos.desde)
    const hasta = fechaFiltro(ctx, "hasta", "La fecha final", datos.hasta)
    if (desde && hasta && desde > hasta) {
      ctx.issues.push({
        campo: "hasta",
        mensaje: "La fecha final no puede ser anterior a la inicial.",
      })
    }
    const limite = enteroRequerido(
      ctx,
      "limite",
      "El límite",
      datos.limite ?? 100,
      { min: 1, max: 365 }
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { doctorId, status, desde, hasta, limite } }
  }
)

export type CrearLiquidacionInput = {
  doctorId: string
  periodStart: string
  periodEnd: string
  /** Tasa BCV para expresar el neto en bolívares; vacío = tasa vigente. */
  bcvRate: number | null
  /** true → además de generar, aprueba la liquidación. */
  aprobar: boolean
  notes: string | null
}

export const crearLiquidacionSchema = crearEsquema<CrearLiquidacionInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const doctorId = uuidOpcional(
      ctx,
      "doctorId",
      "El especialista",
      datos.doctorId
    )
    if (!doctorId) {
      ctx.issues.push({
        campo: "doctorId",
        mensaje: "Selecciona el especialista a liquidar.",
      })
    }

    const periodStart = fechaRequerida(
      ctx,
      "periodStart",
      "El inicio del período",
      datos.periodStart
    )
    const periodEnd = fechaRequerida(
      ctx,
      "periodEnd",
      "El fin del período",
      datos.periodEnd
    )
    if (periodStart > periodEnd) {
      ctx.issues.push({
        campo: "periodEnd",
        mensaje: "El fin del período no puede ser anterior al inicio.",
      })
    }

    const tasaBruta = Number(String(datos.bcvRate ?? "").replace(",", "."))
    const bcvRate =
      !datos.bcvRate || !Number.isFinite(tasaBruta) || tasaBruta <= 0
        ? null
        : decimalRequerido(ctx, "bcvRate", "La tasa BCV", tasaBruta, {
            min: 0.0001,
            max: 1_000_000,
            decimales: 4,
          })

    const aprobar = booleano(datos.aprobar, false)
    const notes = textoOpcional(ctx, "notes", "La nota", datos.notes, {
      max: 500,
    })

    if (ctx.issues.length > 0 || !doctorId) {
      return { success: false, error: error(ctx) }
    }
    return {
      success: true,
      data: {
        doctorId,
        periodStart,
        periodEnd,
        bcvRate,
        aprobar,
        notes,
      },
    }
  }
)

export const ACCIONES_LIQUIDACION = ["aprobar", "pagar", "notas"] as const
export type AccionLiquidacion = (typeof ACCIONES_LIQUIDACION)[number]

export type ActualizarLiquidacionInput = {
  accion: AccionLiquidacion
  /** Obligatoria al marcar como pagada (dato bancario/comprobante). */
  paymentReference: string | null
  notes: string | null
}

export const actualizarLiquidacionSchema =
  crearEsquema<ActualizarLiquidacionInput>((entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const accion = enumerado<AccionLiquidacion>(
      ctx,
      "accion",
      "La acción",
      datos.accion,
      ACCIONES_LIQUIDACION,
      null
    )
    const paymentReference = textoOpcional(
      ctx,
      "paymentReference",
      "La referencia de pago",
      datos.paymentReference,
      { max: 120 }
    )
    const notes = textoOpcional(ctx, "notes", "La nota", datos.notes, {
      max: 500,
    })

    if (accion === "pagar" && !paymentReference) {
      ctx.issues.push({
        campo: "paymentReference",
        mensaje:
          "Indica la referencia del pago (transferencia, Pago Móvil o Zelle) para marcarla como pagada.",
      })
    }

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { accion, paymentReference, notes } }
  })

/** Fecha ISO opcional para filtros (vacío = sin límite). */
function fechaFiltro(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown
): string | null {
  const limpio = textoOpcional(ctx, campo, etiqueta, valor, { max: 10 })
  if (!limpio) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe tener el formato YYYY-MM-DD.`,
    })
  }
  return limpio
}
