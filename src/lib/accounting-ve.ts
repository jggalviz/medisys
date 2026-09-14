/**
 * MEDISYS · Motor contable venezolano (Módulo 3)
 * -----------------------------------------------
 * Funciones PURAS (sin red ni Supabase) que implementan:
 *
 *  1. Libro de Ventas del SENIAT: estructura oficial por operación (fecha,
 *     RIF/Cédula, nombre, N° de factura, N° de control, notas de crédito y
 *     débito, total incluyendo IVA, ventas exentas, base imponible, alícuota,
 *     IVA debitado e IGTF percibido) más su consolidado mensual.
 *  2. Cuadre/arqueo de caja: esperado por el sistema vs. contado por el cajero,
 *     con desglose por método de cobro y detección de faltantes/sobrantes.
 *  3. Liquidación de honorarios médicos: extrae las líneas de las facturas
 *     cobradas, aplica la comisión pactada y calcula el neto a pagar.
 *  4. Exportación a CSV (Excel/Google Sheets) del libro de ventas.
 *
 * Importable desde componentes cliente: no depende de Supabase.
 */
import type {
  DailyClosingStatus,
  PaymentMethod,
  SettlementStatus,
} from "@/types/database"
import type {
  ArqueoCalculado,
  ArqueoMetodoFila,
  CierreCajaDTO,
  EstadoArqueo,
  LibroVentasFila,
  LibroVentasReporte,
  LibroVentasResumen,
  LiquidacionDTO,
  LiquidacionDetalleLinea,
  LiquidacionPreview,
  ResumenContabilidad,
} from "@/types/accounting"
import type { FacturaDTO, PagoDTO } from "@/types/billing"
import {
  METODOS_COBRO,
  aVes,
  infoMetodoCobro,
  resumenFacturacion,
  type TonoEstado,
} from "@/lib/billing-ve"
import { redondear2 } from "@/lib/fiscal-ve"

/** Re-export del estado del arqueo (definido en los DTOs del módulo). */
export type { EstadoArqueo }

/** Alícuota general de IVA reflejada en el libro (16%). */
export const ALICUOTA_IVA_LIBRO = 0.16

/** Tolerancia para considerar un arqueo "cuadrado" (en USD). */
export const TOLERANCIA_ARQUEO_USD = 0.01

/* ------------------------------------------------------------------ */
/* Utilidades de fecha                                                 */
/* ------------------------------------------------------------------ */

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0")
}

/** Rango 'YYYY-MM-DD' completo de un mes (1..12) del año indicado. */
export function rangoDelMes(
  anio: number,
  mes: number
): { desde: string; hasta: string } {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return {
    desde: `${anio}-${dosDigitos(mes)}-01`,
    hasta: `${anio}-${dosDigitos(mes)}-${dosDigitos(ultimoDia)}`,
  }
}

/** Año y mes en curso según la hora de Venezuela (America/Caracas). */
export function mesActualVenezuela(): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const [anio, mes] = partes.split("-").map(Number)
  return { anio, mes }
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (formato habitual del libro impreso). */
export function fechaCortaVE(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-")
  if (!anio || !mes || !dia) return fechaIso
  return `${dia}/${mes}/${anio}`
}

/* ------------------------------------------------------------------ */
/* 1. Libro de Ventas SENIAT                                          */
/* ------------------------------------------------------------------ */

/**
 * Construye las filas del Libro de Ventas a partir de las facturas del
 * período (con su detalle, cobros y notas de ajuste).
 *
 * Reglas:
 *  - El IGTF se reporta como columna aparte (nunca dentro de la base del IVA).
 *  - Los importes en VES usan la tasa BCV de cada factura (`bcvRate`), que es
 *    la vigente al momento del cobro.
 *  - Las facturas anuladas/reembolsadas se listan con su nota de crédito para
 *    trazabilidad; sus bases e IVA no se suman al consolidado.
 */
export function construirLibroVentas(
  facturas: readonly FacturaDTO[]
): LibroVentasFila[] {
  return facturas
    .map((factura) => {
      const tasa = Number(factura.bcvRate) || 0
      const perfil = factura.fiscalProfile

      const exentas = redondear2(
        factura.items
          .filter((item) => !item.taxable)
          .reduce((total, item) => total + item.subtotalUSD, 0)
      )
      const base = redondear2(
        factura.items
          .filter((item) => item.taxable)
          .reduce((total, item) => total + item.subtotalUSD, 0)
      )
      const iva = redondear2(
        factura.items.reduce((total, item) => total + item.ivaUSD, 0)
      )
      const totalConIva = redondear2(exentas + base + iva)

      const notaCredito = factura.notas.find((nota) => nota.tipo === "CREDITO")
      const notaDebito = factura.notas.find((nota) => nota.tipo === "DEBITO")

      const tipoOperacion =
        factura.status === "REFUNDED"
          ? "REEMBOLSADA"
          : factura.status === "CANCELLED"
            ? "ANULADA"
            : "VENTA"

      return {
        fecha: factura.createdAt.slice(0, 10),
        tipoDocumento: perfil.tipoDocumento,
        documentoIdentidad: perfil.documentoIdentidad,
        razonSocial: perfil.razonSocial,
        invoiceNumber: factura.invoiceNumber,
        controlNumber: factura.controlNumber,
        notaCreditoNumber: notaCredito?.noteNumber ?? null,
        notaDebitoNumber: notaDebito?.noteNumber ?? null,
        notaCreditoUSD: redondear2(notaCredito?.amountUSD ?? 0),
        notaDebitoUSD: redondear2(notaDebito?.amountUSD ?? 0),
        totalConIvaUSD: totalConIva,
        ventasExentasUSD: exentas,
        baseImponibleUSD: base,
        alicuota: base > 0 ? ALICUOTA_IVA_LIBRO : 0,
        ivaDebitadoUSD: iva,
        igtfPercibidoUSD: redondear2(factura.igtfUSD),
        totalConIvaVES: aVes(totalConIva, tasa),
        ivaDebitadoVES: aVes(iva, tasa),
        igtfPercibidoVES: aVes(factura.igtfUSD, tasa),
        status: factura.status,
        paymentStatus: factura.paymentStatus,
        tipoOperacion,
      } satisfies LibroVentasFila
    })
    .sort((a, b) => (a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? -1 : 1))
}

/**
 * Consolida el período: las columnas fiscales solo suman las operaciones
 * vigentes (`VENTA`); las notas de crédito/débito se informan aparte y netean
 * el total facturado. Los importes en VES usan la tasa de referencia del
 * reporte para que todas las filas sean homogéneas.
 */
export function resumirLibroVentas(
  filas: readonly LibroVentasFila[],
  tasaReferencia: number
): LibroVentasResumen {
  const vigentes = filas.filter((fila) => fila.tipoOperacion === "VENTA")

  const exentas = redondear2(
    vigentes.reduce((total, fila) => total + fila.ventasExentasUSD, 0)
  )
  const base = redondear2(
    vigentes.reduce((total, fila) => total + fila.baseImponibleUSD, 0)
  )
  const iva = redondear2(
    vigentes.reduce((total, fila) => total + fila.ivaDebitadoUSD, 0)
  )
  const igtf = redondear2(
    vigentes.reduce((total, fila) => total + fila.igtfPercibidoUSD, 0)
  )
  const totalBruto = redondear2(
    vigentes.reduce((total, fila) => total + fila.totalConIvaUSD, 0)
  )
  const notaCredito = redondear2(
    filas.reduce((total, fila) => total + fila.notaCreditoUSD, 0)
  )
  const notaDebito = redondear2(
    filas.reduce((total, fila) => total + fila.notaDebitoUSD, 0)
  )

  // Total facturado neto = ventas vigentes − notas de crédito + notas de débito.
  const totalNeto = redondear2(totalBruto - notaCredito + notaDebito)
  const tributos = redondear2(iva + igtf)

  return {
    operaciones: filas.length,
    facturas: vigentes.length,
    anuladas: filas.length - vigentes.length,
    totalConIvaUSD: totalNeto,
    totalConIvaVES: aVes(totalNeto, tasaReferencia),
    ventasExentasUSD: exentas,
    ventasExentasVES: aVes(exentas, tasaReferencia),
    baseImponibleUSD: base,
    baseImponibleVES: aVes(base, tasaReferencia),
    ivaDebitadoUSD: iva,
    ivaDebitadoVES: aVes(iva, tasaReferencia),
    igtfPercibidoUSD: igtf,
    igtfPercibidoVES: aVes(igtf, tasaReferencia),
    totalTributosUSD: tributos,
    totalTributosVES: aVes(tributos, tasaReferencia),
    notaCreditoUSD: notaCredito,
    notaDebitoUSD: notaDebito,
  }
}

/* ------------------------------------------------------------------ */
/* 2. Exportación del libro (CSV para Excel / Google Sheets)           */
/* ------------------------------------------------------------------ */

/** Encabezados en el orden de la providencia del SENIAT. */
export const COLUMNAS_LIBRO_VENTAS: readonly string[] = [
  "Fecha",
  "Tipo Doc.",
  "RIF/CI",
  "Nombre o Razón Social",
  "N° Factura",
  "N° Control",
  "N° Nota Crédito",
  "N° Nota Débito",
  "Total Ventas Incl. IVA (USD)",
  "Ventas No Gravadas/Exentas (USD)",
  "Base Imponible (USD)",
  "Alícuota",
  "IVA Debitado (USD)",
  "IGTF Percibido (USD)",
  "Total Ventas Incl. IVA (Bs)",
  "IVA Debitado (Bs)",
  "IGTF Percibido (Bs)",
  "Operación",
]

/** Celda CSV con comillas y escape de comillas internas. */
function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '""'
  const texto = typeof valor === "number" ? valor.toFixed(2) : String(valor)
  return `"${texto.replace(/"/g, '""')}"`
}

/**
 * Serializa el reporte a CSV (separador coma, punto decimal, BOM UTF-8 para
 * que Excel respete los acentos). Incluye cabecera del período y fila de
 * totales al final.
 */
export function libroVentasACSV(reporte: LibroVentasReporte): string {
  const lineas: string[] = []

  lineas.push([celda("LIBRO DE VENTAS · SENIAT"), celda(reporte.desde), celda(reporte.hasta)].join(","))
  lineas.push([celda("Tasa BCV de referencia"), celda(reporte.tasaReferencia)].join(","))
  lineas.push("")
  lineas.push(COLUMNAS_LIBRO_VENTAS.map((columna) => celda(columna)).join(","))

  for (const fila of reporte.filas) {
    lineas.push(
      [
        celda(fechaCortaVE(fila.fecha)),
        celda(fila.tipoDocumento),
        celda(fila.documentoIdentidad),
        celda(fila.razonSocial),
        celda(fila.invoiceNumber ?? "BORRADOR"),
        celda(fila.controlNumber ?? ""),
        celda(fila.notaCreditoNumber ?? ""),
        celda(fila.notaDebitoNumber ?? ""),
        celda(fila.totalConIvaUSD),
        celda(fila.ventasExentasUSD),
        celda(fila.baseImponibleUSD),
        celda(`${Math.round(fila.alicuota * 100)}%`),
        celda(fila.ivaDebitadoUSD),
        celda(fila.igtfPercibidoUSD),
        celda(fila.totalConIvaVES),
        celda(fila.ivaDebitadoVES),
        celda(fila.igtfPercibidoVES),
        celda(fila.tipoOperacion),
      ].join(",")
    )
  }

  const r = reporte.resumen
  lineas.push(
    [
      celda("TOTALES"),
      celda(`${r.facturas} facturas`),
      celda(""),
      celda(""),
      celda(""),
      celda(""),
      celda(r.notaCreditoUSD),
      celda(r.notaDebitoUSD),
      celda(r.totalConIvaUSD),
      celda(r.ventasExentasUSD),
      celda(r.baseImponibleUSD),
      celda(`${Math.round(ALICUOTA_IVA_LIBRO * 100)}%`),
      celda(r.ivaDebitadoUSD),
      celda(r.igtfPercibidoUSD),
      celda(r.totalConIvaVES),
      celda(r.ivaDebitadoVES),
      celda(r.igtfPercibidoVES),
      celda(`${r.anuladas} anuladas`),
    ].join(",")
  )

  return `\ufeff${lineas.join("\r\n")}`
}

/** Nombre sugerido del archivo exportado. */
export function nombreArchivoLibro(reporte: LibroVentasReporte): string {
  return `libro-ventas-${reporte.anio}-${String(reporte.mes).padStart(2, "0")}.csv`
}

/* ------------------------------------------------------------------ */
/* 3. Cuadre y arqueo de caja                                          */
/* ------------------------------------------------------------------ */

/**
 * Calcula lo esperado por el sistema para una jornada: suma los cobros
 * VERIFICADOS agrupados por método de cobro (base + IGTF, ya que el IGTF
 * también entró a la caja).
 */
export function calcularArqueo(entrada: {
  closingDate: string
  pagos: readonly PagoDTO[]
  tasa: number
}): ArqueoCalculado {
  const { closingDate, pagos, tasa } = entrada
  const verificados = pagos.filter((pago) => pago.status === "VERIFIED")

  const breakdown: ArqueoMetodoFila[] = METODOS_COBRO.map((method) => {
    const delMetodo = verificados.filter((pago) => pago.method === method)
    const esperadoUSD = redondear2(
      delMetodo.reduce(
        (total, pago) => total + pago.amountUSD + pago.igtfAmountUSD,
        0
      )
    )
    const esperadoVES = redondear2(
      delMetodo.reduce(
        (total, pago) =>
          total +
          (pago.amountVES || aVes(pago.amountUSD, tasa)) +
          (pago.igtfAmountVES || aVes(pago.igtfAmountUSD, tasa)),
        0
      )
    )

    return {
      method,
      expectedUSD: esperadoUSD,
      expectedVES: esperadoVES,
      countedUSD: 0,
      countedVES: 0,
      differenceUSD: 0,
      differenceVES: 0,
      operaciones: delMetodo.length,
    } satisfies ArqueoMetodoFila
  })

  const esperadoUSD = redondear2(
    breakdown.reduce((total, fila) => total + fila.expectedUSD, 0)
  )
  const esperadoVES = redondear2(
    breakdown.reduce((total, fila) => total + fila.expectedVES, 0)
  )

  return {
    closingDate,
    esperadoUSD,
    esperadoVES,
    operaciones: verificados.length,
    breakdown,
  }
}

/** Compara lo esperado contra el conteo físico y clasifica el descalce. */
export function calcularDiferencias(
  esperado: { usd: number; ves: number },
  contado: { usd: number; ves: number }
): {
  differenceUSD: number
  differenceVES: number
  estado: EstadoArqueo
} {
  const differenceUSD = redondear2(contado.usd - esperado.usd)
  const differenceVES = redondear2(contado.ves - esperado.ves)

  const cuadrado =
    Math.abs(differenceUSD) <= TOLERANCIA_ARQUEO_USD &&
    Math.abs(differenceVES) <= TOLERANCIA_ARQUEO_USD

  return {
    differenceUSD,
    differenceVES,
    estado: cuadrado
      ? "CUADRADO"
      : differenceUSD >= 0 && differenceVES >= 0
        ? "SOBRANTE"
        : "FALTANTE",
  }
}

/** Totales contados a partir del desglose por método (lo que reporta caja). */
export function totalesDesdeBreakdown(
  breakdown: readonly ArqueoMetodoFila[]
): { usd: number; ves: number } {
  return {
    usd: redondear2(breakdown.reduce((total, fila) => total + fila.countedUSD, 0)),
    ves: redondear2(breakdown.reduce((total, fila) => total + fila.countedVES, 0)),
  }
}

/**
 * Recalcula el desglose aplicando los montos contados por la caja y devuelve
 * el desglose completo con diferencias + los totales del arqueo.
 */
export function aplicarConteo(
  breakdown: readonly ArqueoMetodoFila[],
  conteo: readonly { method: PaymentMethod; countedUSD: number; countedVES: number }[]
): {
  breakdown: ArqueoMetodoFila[]
  esperadoUSD: number
  esperadoVES: number
  contadoUSD: number
  contadoVES: number
  differenceUSD: number
  differenceVES: number
  estado: EstadoArqueo
} {
  const mapa = new Map(conteo.map((fila) => [fila.method, fila]))

  const completo = breakdown.map((fila) => {
    const contado = mapa.get(fila.method)
    const countedUSD = redondear2(Math.max(0, contado?.countedUSD ?? 0))
    const countedVES = redondear2(Math.max(0, contado?.countedVES ?? 0))
    return {
      ...fila,
      countedUSD,
      countedVES,
      differenceUSD: redondear2(countedUSD - fila.expectedUSD),
      differenceVES: redondear2(countedVES - fila.expectedVES),
    } satisfies ArqueoMetodoFila
  })

  const esperadoUSD = redondear2(
    completo.reduce((total, fila) => total + fila.expectedUSD, 0)
  )
  const esperadoVES = redondear2(
    completo.reduce((total, fila) => total + fila.expectedVES, 0)
  )
  const contadoUSD = redondear2(
    completo.reduce((total, fila) => total + fila.countedUSD, 0)
  )
  const contadoVES = redondear2(
    completo.reduce((total, fila) => total + fila.countedVES, 0)
  )
  const { differenceUSD, differenceVES, estado } = calcularDiferencias(
    { usd: esperadoUSD, ves: esperadoVES },
    { usd: contadoUSD, ves: contadoVES }
  )

  return {
    breakdown: completo,
    esperadoUSD,
    esperadoVES,
    contadoUSD,
    contadoVES,
    differenceUSD,
    differenceVES,
    estado,
  }
}

/* ------------------------------------------------------------------ */
/* 4. Liquidación de honorarios médicos                                */
/* ------------------------------------------------------------------ */

/**
 * Consolida las líneas facturadas de un especialista en una liquidación:
 *  - `grossAmountUSD`: monto bruto facturado por sus servicios (sin IVA).
 *  - `netPayableUSD`: honorarios pactados (columna
 *    `invoice_items.doctor_commission_amount`).
 *  - `commissionDeductedUSD`: comisión retenida por la clínica.
 */
export function liquidarHonorarios(entrada: {
  doctorId: string
  doctorNombre: string
  periodStart: string
  periodEnd: string
  tasa: number
  lineas: readonly LiquidacionDetalleLinea[]
}): LiquidacionPreview {
  const { doctorId, doctorNombre, periodStart, periodEnd, tasa, lineas } = entrada

  const grossAmountUSD = redondear2(
    lineas.reduce((total, linea) => total + linea.grossUSD, 0)
  )
  const netPayableUSD = redondear2(
    lineas.reduce((total, linea) => total + linea.netUSD, 0)
  )
  const commissionDeductedUSD = redondear2(grossAmountUSD - netPayableUSD)
  const totalServicesCount = lineas.reduce(
    (total, linea) => total + linea.quantity,
    0
  )
  const facturasConsideradas = new Set(lineas.map((linea) => linea.invoiceId))
    .size

  return {
    doctorId,
    doctorNombre,
    periodStart,
    periodEnd,
    totalServicesCount,
    grossAmountUSD,
    commissionDeductedUSD: Math.max(0, commissionDeductedUSD),
    netPayableUSD,
    netPayableVES: aVes(netPayableUSD, tasa),
    tasa,
    facturasConsideradas,
    detalle: [...lineas],
  }
}

/* ------------------------------------------------------------------ */
/* 5. Etiquetas y tonos para la UI                                     */
/* ------------------------------------------------------------------ */

export const ETIQUETA_ESTADO_CIERRE: Record<DailyClosingStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  AUDITED: "Auditado",
}

export const TONO_ESTADO_CIERRE: Record<DailyClosingStatus, TonoEstado> = {
  OPEN: "amber",
  CLOSED: "sky",
  AUDITED: "emerald",
}

export const ETIQUETA_ESTADO_LIQUIDACION: Record<SettlementStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  PAID: "Pagada",
}

export const TONO_ESTADO_LIQUIDACION: Record<SettlementStatus, TonoEstado> = {
  PENDING: "amber",
  APPROVED: "sky",
  PAID: "emerald",
}

export const ETIQUETA_ESTADO_ARQUEO: Record<EstadoArqueo, string> = {
  CUADRADO: "Cuadrado",
  SOBRANTE: "Sobrante",
  FALTANTE: "Faltante",
}

export const TONO_ESTADO_ARQUEO: Record<EstadoArqueo, TonoEstado> = {
  CUADRADO: "emerald",
  SOBRANTE: "amber",
  FALTANTE: "red",
}

/* ------------------------------------------------------------------ */
/* 6. Resumen contable del período                                     */
/* ------------------------------------------------------------------ */

/**
 * Compone los KPIs del bloque contable a partir de las facturas del período,
 * los cierres de caja y las liquidaciones de honorarios.
 */
export function componerResumenContabilidad(entrada: {
  facturas: readonly FacturaDTO[]
  cierres: readonly CierreCajaDTO[]
  liquidaciones: readonly LiquidacionDTO[]
}): ResumenContabilidad {
  const { facturas, cierres, liquidaciones } = entrada

  const ventas = resumenFacturacion(facturas)
  const cierresAbiertos = cierres.filter((cierre) => cierre.status === "OPEN")
  const liquidadas = liquidaciones.filter((item) => item.status !== "PENDING")
  const pendientes = liquidaciones.filter((item) => item.status === "PENDING")

  return {
    ventasUSD: ventas.totalUSD,
    ventasVES: ventas.totalVES,
    ivaUSD: ventas.ivaUSD,
    igtfUSD: ventas.igtfUSD,
    cobradoUSD: ventas.cobradoUSD,
    porCobrarUSD: ventas.porCobrarUSD,
    cierresAbiertos: cierresAbiertos.length,
    diferenciaCajaUSD: redondear2(
      cierres.reduce((total, cierre) => total + cierre.differenceUSD, 0)
    ),
    liquidacionesPendientesUSD: redondear2(
      pendientes.reduce((total, item) => total + item.netPayableUSD, 0)
    ),
    liquidacionesPagadasUSD: redondear2(
      liquidadas
        .filter((item) => item.status === "PAID")
        .reduce((total, item) => total + item.netPayableUSD, 0)
    ),
  }
}

/** Etiqueta legible de un método de cobro (atajo para tablas y CSV). */
export function etiquetaMetodoCobro(method: PaymentMethod): string {
  return infoMetodoCobro(method).label
}
