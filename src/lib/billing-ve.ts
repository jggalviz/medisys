/**
 * MEDISYS · Motor fiscal venezolano de facturación (Módulo 2)
 * ------------------------------------------------------------
 * Funciones PURAS (sin acceso a red ni a Supabase) que implementan:
 *
 *  1. IVA general del 16% sobre las líneas gravadas (los servicios médicos
 *     directos suelen ser EXENTOS: `taxable = false`).
 *  2. IGTF (Impuesto a las Grandes Transacciones Financieras, 3%): se aplica
 *     al cobro cuando el medio de pago es en divisas o efectivo no nacional
 *     (Zelle, Efectivo USD). Se suma al total a pagar.
 *  3. Doble despliegue fiscal: todo importe se calcula en USD (base del
 *     catálogo) y en VES a la tasa oficial BCV usada en el cobro, de modo que
 *     la factura cumpla con el desglose exigido por el SENIAT.
 *  4. Formateo de la numeración fiscal (correlativo + N° de control de formas
 *     libres) y etiquetas/tonos de estado para la UI.
 *
 * Es importable desde componentes cliente: no depende de Supabase.
 */
import type {
  DoctorCommissionType,
  InvoiceFiscalProfile,
  InvoicePaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database"
import type {
  DesgloseCobro,
  DesgloseFactura,
  FacturaDTO,
  FacturaItemDTO,
  MetodoCobroInfo,
  PagoDTO,
  ResumenFacturacion,
} from "@/types/billing"
import {
  IVA_VENEZUELA,
  alicuotaIva,
  redondear2,
} from "@/lib/fiscal-ve"

/** Alícuota del IGTF vigente en Venezuela (3%). */
export const ALICUOTA_IGTF = 0.03

/** Catálogo de métodos de cobro de la caja. */
export const METODOS_COBRO: readonly PaymentMethod[] = [
  "PAGO_MOVIL",
  "ZELLE",
  "TRANSFERENCIA_VES",
  "EFECTIVO_USD",
  "EFECTIVO_VES",
  "PUNTO_DE_VENTA",
]

/**
 * Reglas por método de cobro.
 *
 * IGTF: la ley grava los pagos realizados en moneda extranjera (o con
 * instrumentos denominados en divisas). Por eso Zelle y el efectivo USD
 * generan el 3%; Pago Móvil, transferencia en VES, efectivo en bolívares y
 * punto de venta no lo causan.
 */
export const METODO_COBRO_INFO: Record<PaymentMethod, MetodoCobroInfo> = {
  PAGO_MOVIL: {
    metodo: "PAGO_MOVIL",
    label: "Pago Móvil",
    moneda: "VES",
    aplicaIgtf: false,
    requiereReferencia: true,
    detalle: "Transferencia inmediata en bolívares desde la banca en línea.",
  },
  ZELLE: {
    metodo: "ZELLE",
    label: "Zelle",
    moneda: "USD",
    aplicaIgtf: true,
    requiereReferencia: true,
    detalle: "Pago en divisas: aplica IGTF 3%.",
  },
  TRANSFERENCIA_VES: {
    metodo: "TRANSFERENCIA_VES",
    label: "Transferencia (Bs.)",
    moneda: "VES",
    aplicaIgtf: false,
    requiereReferencia: true,
    detalle: "Transferencia bancaria nacional en bolívares.",
  },
  EFECTIVO_USD: {
    metodo: "EFECTIVO_USD",
    label: "Efectivo USD",
    moneda: "USD",
    aplicaIgtf: true,
    requiereReferencia: false,
    detalle: "Efectivo en divisas: aplica IGTF 3%.",
  },
  EFECTIVO_VES: {
    metodo: "EFECTIVO_VES",
    label: "Efectivo Bs.",
    moneda: "VES",
    aplicaIgtf: false,
    requiereReferencia: false,
    detalle: "Efectivo en bolívares.",
  },
  PUNTO_DE_VENTA: {
    metodo: "PUNTO_DE_VENTA",
    label: "Punto de venta",
    moneda: "VES",
    aplicaIgtf: false,
    requiereReferencia: false,
    detalle: "Débito/crédito nacional procesado en bolívares.",
  },
}

/** Información del método (nunca `undefined`, con respaldo a Pago Móvil). */
export function infoMetodoCobro(metodo: PaymentMethod): MetodoCobroInfo {
  return METODO_COBRO_INFO[metodo] ?? METODO_COBRO_INFO.PAGO_MOVIL
}

/** ¿El método de cobro causa IGTF? */
export function aplicaIgtf(metodo: PaymentMethod): boolean {
  return infoMetodoCobro(metodo).aplicaIgtf
}

/** IGTF de un monto en USD (3%), redondeado a 2 decimales. */
export function calcularIgtf(montoUSD: number): number {
  if (!Number.isFinite(montoUSD) || montoUSD <= 0) return 0
  return redondear2(montoUSD * ALICUOTA_IGTF)
}

/** Conversión USD → VES con la tasa oficial (Bs por USD). */
export function aVes(montoUSD: number, tasa: number): number {
  if (!Number.isFinite(montoUSD)) return 0
  if (!Number.isFinite(tasa) || tasa <= 0) return 0
  return redondear2(montoUSD * tasa)
}

/** Conversión VES → USD con la tasa oficial (Bs por USD). */
export function aUsd(montoVES: number, tasa: number): number {
  if (!Number.isFinite(montoVES)) return 0
  if (!Number.isFinite(tasa) || tasa <= 0) return 0
  return redondear2(montoVES / tasa)
}

/* ------------------------------------------------------------------ */
/* Cálculo de líneas y totales de la factura                          */
/* ------------------------------------------------------------------ */

export type EntradaLineaFactura = {
  description: string
  quantity: number
  unitPriceUSD: number
  taxable: boolean
  serviceId?: string | null
  doctorId?: string | null
  doctorCommissionAmount?: number
  doctorCommissionType?: DoctorCommissionType | null
}

/** Calcula subtotal, IVA y total de una línea + su equivalente en VES. */
export function calcularLineaFactura(
  entrada: EntradaLineaFactura,
  tasa: number
): FacturaItemDTO {
  const cantidad = Number.isFinite(entrada.quantity)
    ? Math.max(1, Math.trunc(entrada.quantity))
    : 1
  const precio = Math.max(0, Number(entrada.unitPriceUSD) || 0)
  const subtotal = redondear2(precio * cantidad)
  const alicuota = alicuotaIva(Boolean(entrada.taxable))
  const iva = redondear2(subtotal * alicuota)

  return {
    id: "",
    serviceId: entrada.serviceId ?? null,
    description: entrada.description,
    quantity: cantidad,
    unitPriceUSD: redondear2(precio),
    unitPriceVES: aVes(precio, tasa),
    taxable: Boolean(entrada.taxable),
    alicuotaIva: alicuota,
    subtotalUSD: subtotal,
    subtotalVES: aVes(subtotal, tasa),
    ivaUSD: iva,
    ivaVES: aVes(iva, tasa),
    totalUSD: redondear2(subtotal + iva),
    totalVES: aVes(subtotal + iva, tasa),
    doctorId: entrada.doctorId ?? null,
    doctorCommissionAmount: redondear2(
      Math.max(0, Number(entrada.doctorCommissionAmount) || 0)
    ),
    doctorCommissionType: entrada.doctorCommissionType ?? null,
  }
}

/**
 * Totales de la factura con doble despliegue.
 *
 * `igtfUSD` corresponde al IGTF ya causado por los cobros en divisas
 * registrados; se recalcula cada vez que se cobra (ver `desglosarCobro`).
 */
export function calcularTotalesFactura(
  items: readonly Pick<
    FacturaItemDTO,
    "subtotalUSD" | "ivaUSD" | "doctorCommissionAmount"
  >[],
  opciones: { tasa: number; igtfUSD?: number }
): DesgloseFactura {
  const { tasa, igtfUSD = 0 } = opciones
  const subtotal = redondear2(
    items.reduce((total, item) => total + item.subtotalUSD, 0)
  )
  const iva = redondear2(items.reduce((total, item) => total + item.ivaUSD, 0))
  const igtf = redondear2(Math.max(0, igtfUSD))

  return {
    tasa,
    subtotalUSD: subtotal,
    subtotalVES: aVes(subtotal, tasa),
    vatUSD: iva,
    vatVES: aVes(iva, tasa),
    igtfUSD: igtf,
    igtfVES: aVes(igtf, tasa),
    totalUSD: redondear2(subtotal + iva + igtf),
    totalVES: aVes(subtotal + iva + igtf, tasa),
  }
}

/** Suma de honorarios médicos de las líneas (para reportes de nómina). */
export function totalHonorariosMedicos(
  items: readonly Pick<FacturaItemDTO, "doctorCommissionAmount">[]
): number {
  return redondear2(
    items.reduce((total, item) => total + (item.doctorCommissionAmount || 0), 0)
  )
}

/** Alícuota de IVA aplicada a la factura (16% si hay al menos una línea gravada). */
export function alicuotaFactura(
  items: readonly Pick<FacturaItemDTO, "taxable">[]
): number {
  return items.some((item) => item.taxable) ? IVA_VENEZUELA : 0
}

/* ------------------------------------------------------------------ */
/* Cobros (IGTF)                                                      */
/* ------------------------------------------------------------------ */

/**
 * Desglose de un cobro: base en USD/VES, IGTF (3% si aplica) y total.
 * Si el monto llega en bolívares se convierte con la tasa de la factura.
 */
export function desglosarCobro(entrada: {
  metodo: PaymentMethod
  montoUSD?: number
  montoVES?: number
  tasa: number
}): DesgloseCobro {
  const info = infoMetodoCobro(entrada.metodo)
  const tasa = Number.isFinite(entrada.tasa) && entrada.tasa > 0 ? entrada.tasa : 0

  // La base se expresa siempre en USD (moneda de la factura).
  const baseUSD =
    entrada.montoUSD !== undefined && Number.isFinite(entrada.montoUSD)
      ? redondear2(Math.max(0, entrada.montoUSD))
      : aUsd(entrada.montoVES ?? 0, tasa)

  const igtf = info.aplicaIgtf ? calcularIgtf(baseUSD) : 0
  const total = redondear2(baseUSD + igtf)

  return {
    metodo: entrada.metodo,
    moneda: info.moneda,
    aplicaIgtf: info.aplicaIgtf,
    baseUSD,
    baseVES: aVes(baseUSD, tasa),
    igtfUSD: igtf,
    igtfVES: aVes(igtf, tasa),
    totalUSD: total,
    totalVES: aVes(total, tasa),
    tasa,
  }
}

/**
 * Recalcula el estado de cobro de una factura a partir de sus pagos.
 * Solo los cobros VERIFIED cuentan como dinero recibido; el IGTF cobrado se
 * acumula aparte para que el total a pagar refleje el recargo legal.
 */
export function recalcularEstadoCobro(
  factura: Pick<FacturaDTO, "subtotalUSD" | "vatUSD" | "totalUSD">,
  pagos: readonly Pick<
    PagoDTO,
    "amountUSD" | "igtfAmountUSD" | "status"
  >[]
): {
  pagadoUSD: number
  saldoUSD: number
  igtfUSD: number
  totalUSD: number
  paymentStatus: InvoicePaymentStatus
} {
  const verificados = pagos.filter((pago) => pago.status === "VERIFIED")
  const pagadoUSD = redondear2(
    verificados.reduce(
      (total, pago) => total + (pago.amountUSD || 0) + (pago.igtfAmountUSD || 0),
      0
    )
  )
  const igtfUSD = redondear2(
    verificados.reduce((total, pago) => total + (pago.igtfAmountUSD || 0), 0)
  )
  const totalUSD = redondear2(factura.subtotalUSD + factura.vatUSD + igtfUSD)
  const saldoUSD = Math.max(0, redondear2(totalUSD - pagadoUSD))

  const paymentStatus: InvoicePaymentStatus =
    pagadoUSD <= 0
      ? "PENDING"
      : saldoUSD > 0.01
        ? "PARTIAL"
        : "PAID"

  return { pagadoUSD, saldoUSD, igtfUSD, totalUSD, paymentStatus }
}

/* ------------------------------------------------------------------ */
/* Numeración fiscal (correlativo + N° de control)                     */
/* ------------------------------------------------------------------ */

/** Correlativo de factura a 8 dígitos: `42` → `00000042`. */
export function formatearNumeroFactura(
  correlativo: number,
  prefijo = ""
): string {
  const numero = Math.max(1, Math.trunc(correlativo))
  return `${prefijo}${String(numero).padStart(8, "0")}`
}

/**
 * N° de control de formas libres: `42` → `00-00000042`.
 * El prefijo corresponde a la serie autorizada por la imprenta/SENIAT.
 */
export function formatearNumeroControl(
  correlativo: number,
  prefijo = "00"
): string {
  const numero = Math.max(1, Math.trunc(correlativo))
  return `${prefijo}-${String(numero).padStart(8, "0")}`
}

/* ------------------------------------------------------------------ */
/* Etiquetas y tonos para la UI                                       */
/* ------------------------------------------------------------------ */

/** Tono semántico; la UI lo traduce a clases Tailwind. */
export type TonoEstado = "muted" | "amber" | "emerald" | "sky" | "red"

export const ETIQUETA_ESTADO_FACTURA: Record<InvoiceStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PAID: "Pagada",
  CANCELLED: "Anulada",
  REFUNDED: "Reembolsada",
}

export const TONO_ESTADO_FACTURA: Record<InvoiceStatus, TonoEstado> = {
  DRAFT: "muted",
  ISSUED: "sky",
  PAID: "emerald",
  CANCELLED: "red",
  REFUNDED: "amber",
}

export const ETIQUETA_ESTADO_COBRO: Record<InvoicePaymentStatus, string> = {
  PENDING: "Sin cobrar",
  PARTIAL: "Abonada",
  PAID: "Cobrada",
}

export const TONO_ESTADO_COBRO: Record<InvoicePaymentStatus, TonoEstado> = {
  PENDING: "amber",
  PARTIAL: "sky",
  PAID: "emerald",
}

export const ETIQUETA_ESTADO_PAGO: Record<PaymentStatus, string> = {
  PENDING_VERIFICATION: "Por verificar",
  VERIFIED: "Verificado",
  REJECTED: "Rechazado",
}

export const TONO_ESTADO_PAGO: Record<PaymentStatus, TonoEstado> = {
  PENDING_VERIFICATION: "amber",
  VERIFIED: "emerald",
  REJECTED: "red",
}

/* ------------------------------------------------------------------ */
/* Resumen de facturación (KPIs) y validación fiscal previa            */
/* ------------------------------------------------------------------ */

/** KPIs de un conjunto de facturas (lista ya filtrada por período). */
export function resumenFacturacion(
  facturas: readonly FacturaDTO[]
): ResumenFacturacion {
  const base: ResumenFacturacion = {
    cantidad: facturas.length,
    emitidas: 0,
    pagadas: 0,
    anuladas: 0,
    borradores: 0,
    totalUSD: 0,
    totalVES: 0,
    ivaUSD: 0,
    igtfUSD: 0,
    cobradoUSD: 0,
    porCobrarUSD: 0,
  }

  return facturas.reduce<ResumenFacturacion>((acc, factura) => {
    if (factura.status === "DRAFT") acc.borradores += 1
    if (factura.status === "ISSUED") acc.emitidas += 1
    if (factura.status === "PAID") acc.pagadas += 1
    if (factura.status === "CANCELLED") acc.anuladas += 1

    // Las anuladas no suman a los totales fiscales.
    if (factura.status !== "CANCELLED") {
      acc.totalUSD = redondear2(acc.totalUSD + factura.totalUSD)
      acc.totalVES = redondear2(acc.totalVES + factura.totalVES)
      acc.ivaUSD = redondear2(acc.ivaUSD + factura.vatUSD)
      acc.igtfUSD = redondear2(acc.igtfUSD + factura.igtfUSD)
      acc.cobradoUSD = redondear2(acc.cobradoUSD + factura.pagadoUSD)
      acc.porCobrarUSD = redondear2(acc.porCobrarUSD + factura.saldoUSD)
    }

    return acc
  }, base)
}

/**
 * Datos fiscales mínimos que exige el SENIAT para emitir una factura.
 * Devuelve la lista de campos faltantes (vacía = listo para emitir).
 */
export function faltantesDatosFiscales(
  perfil: Partial<InvoiceFiscalProfile> | null | undefined
): string[] {
  const faltantes: string[] = []
  if (!perfil) return ["Tipo de documento", "Documento", "Razón social", "Dirección fiscal"]

  if (!perfil.tipoDocumento) faltantes.push("Tipo de documento")
  if (!perfil.documentoIdentidad?.trim()) faltantes.push("Documento de identidad")
  if (!perfil.razonSocial?.trim()) faltantes.push("Razón social / nombre")
  if (!perfil.direccionFiscal?.trim()) faltantes.push("Dirección fiscal")

  return faltantes
}
