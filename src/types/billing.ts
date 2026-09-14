/**
 * MEDISYS · Tipos del Módulo 2 (Facturación y Cobros)
 * ----------------------------------------------------
 * DTOs camelCase compartidos entre:
 *   - el motor de cálculo puro (`src/lib/billing-ve.ts`),
 *   - los servicios de servidor (`src/lib/admin/facturas.ts`),
 *   - las API `/api/admin/invoices/*` y el cliente HTTP (`src/lib/api-facturacion.ts`),
 *   - la UI de `/[clinicSlug]/admin/facturacion`.
 *
 * Las filas de Postgres conservan snake_case en `@/types/database`; aquí se
 * expone la forma "de aplicación" (camelCase) que consumen las vistas.
 */
import type {
  CurrencyCode,
  DoctorCommissionType,
  InvoiceFiscalProfile,
  InvoicePaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  TipoDocumentoFiscal,
} from "@/types/database"

/* ------------------------------ Cobros ------------------------------ */

/** Información operativa de un método de cobro (moneda, IGTF, referencia). */
export type MetodoCobroInfo = {
  metodo: PaymentMethod
  label: string
  /** Moneda en la que se expresa habitualmente el cobro. */
  moneda: CurrencyCode
  /** true cuando corresponde el IGTF del 3% (divisas o efectivo no nacional). */
  aplicaIgtf: boolean
  /** true cuando exige referencia bancaria (Pago Móvil, Zelle, transferencia). */
  requiereReferencia: boolean
  /** Nota corta para la UI. */
  detalle: string
}

/** Desglose de un cobro con su IGTF ya calculado (USD y VES). */
export type DesgloseCobro = {
  metodo: PaymentMethod
  moneda: CurrencyCode
  aplicaIgtf: boolean
  baseUSD: number
  baseVES: number
  igtfUSD: number
  igtfVES: number
  /** Total a pagar = base + IGTF. */
  totalUSD: number
  totalVES: number
  tasa: number
}

/* ------------------------------ Facturas ---------------------------- */

/** Línea de factura lista para pintar (incluye derivados de la línea). */
export type FacturaItemDTO = {
  id: string
  serviceId: string | null
  description: string
  quantity: number
  unitPriceUSD: number
  unitPriceVES: number
  taxable: boolean
  /** Alícuota aplicada al subtotal de la línea (0 = exento). */
  alicuotaIva: number
  /** Subtotal de la línea (cantidad × precio). */
  subtotalUSD: number
  subtotalVES: number
  ivaUSD: number
  ivaVES: number
  totalUSD: number
  totalVES: number
  doctorId: string | null
  doctorCommissionAmount: number
  doctorCommissionType?: DoctorCommissionType | null
}

/** Cobro registrado contra una factura. */
export type PagoDTO = {
  id: string
  invoiceId: string
  sedeId: string | null
  method: PaymentMethod
  amountUSD: number
  amountVES: number
  referenceNumber: string | null
  appliesIgtf: boolean
  igtfAmountUSD: number
  igtfAmountVES: number
  status: PaymentStatus
  notes: string | null
  verifiedAt: string | null
  createdAt: string
}

/** Nota de crédito o débito vinculada a una factura. */
export type NotaAjusteDTO = {
  id: string
  tipo: "CREDITO" | "DEBITO"
  noteNumber: string | null
  controlNumber: string | null
  amountUSD: number
  amountVES: number
  motivo: string
  reembolsada: boolean
  createdAt: string
}

/** Factura completa con detalle, cobros y notas de ajuste. */
export type FacturaDTO = {
  id: string
  tenantId: string
  sedeId: string | null
  sedeNombre: string | null
  invoiceNumber: string | null
  controlNumber: string | null
  patientId: string | null
  patientNombre: string | null
  appointmentId: string | null
  fiscalProfile: InvoiceFiscalProfile
  subtotalUSD: number
  subtotalVES: number
  vatUSD: number
  vatVES: number
  igtfUSD: number
  igtfVES: number
  totalUSD: number
  totalVES: number
  bcvRate: number
  status: InvoiceStatus
  paymentStatus: InvoicePaymentStatus
  notes: string | null
  createdBy: string | null
  issuedAt: string | null
  cancelledAt: string | null
  createdAt: string
  items: FacturaItemDTO[]
  pagos: PagoDTO[]
  notas: NotaAjusteDTO[]
  /** Suma de los cobros verificados (incluye IGTF cobrado). */
  pagadoUSD: number
  /** Saldo pendiente en USD (nunca negativo). */
  saldoUSD: number
}

/** Filtros aceptados por el listado de facturas (API y UI). */
export type FacturaFiltros = {
  /** 'YYYY-MM-DD' inclusive. */
  desde?: string | null
  /** 'YYYY-MM-DD' inclusive. */
  hasta?: string | null
  sedeId?: string | null
  status?: InvoiceStatus | "TODAS" | null
  paymentStatus?: InvoicePaymentStatus | "TODAS" | null
  patientId?: string | null
  /** Búsqueda por N° de factura, N° de control o razón social. */
  q?: string | null
  limite?: number
}

/* ------------------------------ Cálculos ---------------------------- */

/** Desglose fiscal completo de una factura (doble despliegue USD/VES). */
export type DesgloseFactura = {
  tasa: number
  subtotalUSD: number
  subtotalVES: number
  vatUSD: number
  vatVES: number
  igtfUSD: number
  igtfVES: number
  totalUSD: number
  totalVES: number
}

/** KPIs de facturación de un período. */
export type ResumenFacturacion = {
  cantidad: number
  emitidas: number
  pagadas: number
  anuladas: number
  borradores: number
  totalUSD: number
  totalVES: number
  ivaUSD: number
  igtfUSD: number
  cobradoUSD: number
  porCobrarUSD: number
}

/* ------------------------- Respuestas de API ------------------------ */

/** Respuesta de `POST /api/admin/invoices/[id]/payments`. */
export type RespuestaCobro = {
  pago: PagoDTO
  factura: FacturaDTO
  desglose: DesgloseCobro
}

/** Respuesta de `POST /api/admin/invoices/[id]/cancel`. */
export type RespuestaAnulacion = {
  nota: NotaAjusteDTO
  factura: FacturaDTO
}

/** Perfil fiscal mínimo exigible para emitir (validación previa al guardado). */
export type DatosFiscalesFactura = {
  tipoDocumento: TipoDocumentoFiscal
  documentoIdentidad: string
  razonSocial: string
  direccionFiscal: string
}
