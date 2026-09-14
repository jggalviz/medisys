/**
 * MEDISYS · Tipos del Módulo 3 (Contabilidad, Libros Fiscales y Cuadre de Caja)
 * ----------------------------------------------------------------------------
 * DTOs camelCase compartidos entre:
 *   - el motor puro de reportes (`src/lib/accounting-ve.ts`),
 *   - los servicios de servidor (`src/lib/admin/libro-ventas.ts` y
 *     `src/lib/admin/contabilidad.ts`),
 *   - las API `/api/admin/reports|closings|settlements` y su cliente HTTP,
 *   - la UI de `/[clinicSlug]/admin/contabilidad`.
 */
import type {
  ClosingMethodBreakdown,
  DailyClosingStatus,
  InvoicePaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  SettlementStatus,
  TipoDocumentoFiscal,
} from "@/types/database"

/* ------------------------- Libro de Ventas SENIAT ------------------------- */

/** Tipo de operación registrada en el libro (para auditoría). */
export type TipoOperacionLibro = "VENTA" | "ANULADA" | "REEMBOLSADA"

/**
 * Fila del Libro de Ventas en el orden exigido por la providencia del SENIAT:
 * fecha, RIF/Cédula, nombre, N° de factura, N° de control, N° de nota de
 * crédito/débito, total incluyendo IVA, ventas no gravadas/exentas, base
 * imponible, alícuota, IVA debitado y monto de IGTF percibido.
 */
export type LibroVentasFila = {
  /** 'YYYY-MM-DD' de emisión de la factura. */
  fecha: string
  tipoDocumento: TipoDocumentoFiscal
  documentoIdentidad: string
  razonSocial: string
  invoiceNumber: string | null
  controlNumber: string | null
  notaCreditoNumber: string | null
  notaDebitoNumber: string | null
  /** Monto (USD) de la nota de crédito vinculada, si existe. */
  notaCreditoUSD: number
  /** Monto (USD) de la nota de débito vinculada, si existe. */
  notaDebitoUSD: number
  /** Total de la operación incluyendo IVA (USD). */
  totalConIvaUSD: number
  /** Ventas no gravadas / exentas (USD). */
  ventasExentasUSD: number
  /** Base imponible gravada (USD). */
  baseImponibleUSD: number
  /** Alícuota aplicada (0.16 general; 0 si el período solo tuvo exentos). */
  alicuota: number
  ivaDebitadoUSD: number
  /** IGTF efectivamente percibido en los cobros (USD). */
  igtfPercibidoUSD: number
  totalConIvaVES: number
  ivaDebitadoVES: number
  igtfPercibidoVES: number
  status: InvoiceStatus
  paymentStatus: InvoicePaymentStatus
  tipoOperacion: TipoOperacionLibro
}

/** Consolidado del período (resumen mensual de IVA e IGTF). */
export type LibroVentasResumen = {
  operaciones: number
  facturas: number
  anuladas: number
  totalConIvaUSD: number
  totalConIvaVES: number
  ventasExentasUSD: number
  ventasExentasVES: number
  baseImponibleUSD: number
  baseImponibleVES: number
  ivaDebitadoUSD: number
  ivaDebitadoVES: number
  igtfPercibidoUSD: number
  igtfPercibidoVES: number
  /** Total a enterar (IVA + IGTF) en USD/VES. */
  totalTributosUSD: number
  totalTributosVES: number
  notaCreditoUSD: number
  notaDebitoUSD: number
}

/** Reporte completo listo para imprimir o exportar. */
export type LibroVentasReporte = {
  anio: number
  mes: number
  desde: string
  hasta: string
  generadoEn: string
  tasaReferencia: number
  filas: LibroVentasFila[]
  resumen: LibroVentasResumen
}

/** Formatos de exportación soportados por la API del libro. */
export type FormatoExportacion = "json" | "csv"

/* --------------------------- Cuadre de caja ------------------------------- */

/** Fila del desglose por método ya calculada (camelCase). */
export type ArqueoMetodoFila = ClosingMethodBreakdown

/** Resultado del cálculo del sistema para una jornada (antes del conteo). */
export type ArqueoCalculado = {
  closingDate: string
  esperadoUSD: number
  esperadoVES: number
  operaciones: number
  breakdown: ArqueoMetodoFila[]
}

/** Cierre/arqueo de caja listo para la UI. */
export type CierreCajaDTO = {
  id: string
  tenantId: string
  sedeId: string | null
  sedeNombre: string | null
  closingDate: string
  openedBy: string | null
  closedBy: string | null
  totalExpectedUSD: number
  totalExpectedVES: number
  totalActualUSD: number
  totalActualVES: number
  differenceUSD: number
  differenceVES: number
  breakdown: ArqueoMetodoFila[]
  status: DailyClosingStatus
  notes: string | null
  openedAt: string
  closedAt: string | null
  auditedAt: string | null
  createdAt: string
}

/* ------------------------- Honorarios médicos ---------------------------- */

/** Línea del detalle de una liquidación (servicio facturado al médico). */
export type LiquidacionDetalleLinea = {
  invoiceId: string
  invoiceNumber: string | null
  fecha: string
  description: string
  quantity: number
  grossUSD: number
  commissionUSD: number
  netUSD: number
  tipoHonorario: "PERCENTAGE" | "FIXED" | null
}

/** Cálculo de honorarios antes de guardar (preview). */
export type LiquidacionPreview = {
  doctorId: string
  doctorNombre: string
  periodStart: string
  periodEnd: string
  totalServicesCount: number
  grossAmountUSD: number
  commissionDeductedUSD: number
  netPayableUSD: number
  netPayableVES: number
  tasa: number
  facturasConsideradas: number
  detalle: LiquidacionDetalleLinea[]
}

/** Liquidación persistida. */
export type LiquidacionDTO = {
  id: string
  tenantId: string
  doctorId: string
  doctorNombre: string
  periodStart: string
  periodEnd: string
  totalServicesCount: number
  grossAmountUSD: number
  commissionDeductedUSD: number
  netPayableUSD: number
  netPayableVES: number
  bcvRate: number | null
  status: SettlementStatus
  paymentReference: string | null
  notes: string | null
  approvedAt: string | null
  paidAt: string | null
  createdAt: string
}

/* --------------------------- Resumen general ----------------------------- */

/** KPIs del bloque contable (mes en curso). */
export type ResumenContabilidad = {
  ventasUSD: number
  ventasVES: number
  ivaUSD: number
  igtfUSD: number
  cobradoUSD: number
  porCobrarUSD: number
  cierresAbiertos: number
  diferenciaCajaUSD: number
  liquidacionesPendientesUSD: number
  liquidacionesPagadasUSD: number
}

/** Respuesta de `POST /api/admin/closings` y `GET .../:id`. */
export type RespuestaCierre = {
  cierre: CierreCajaDTO
  arqueo: ArqueoCalculado
}

/** Clasificación del descalce de un arqueo. */
export type EstadoArqueo = "CUADRADO" | "SOBRANTE" | "FALTANTE"

/** Opción de método de cobro para el formulario de arqueo. */
export type OpcionArqueo = {
  method: PaymentMethod
  label: string
  esperadoUSD: number
  esperadoVES: number
  operaciones: number
}

/** Especialista mínimo para los selectores del bloque contable. */
export type MedicoOpcion = {
  id: string
  nombre: string
  especialidad: string
}
