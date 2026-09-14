"use client"

/**
 * MEDISYS · Cliente HTTP del Módulo 2 (Facturación y Cobros)
 * ==========================================================
 * Envuelve `/api/admin/invoices/*` con tipos y errores normalizados para los
 * componentes de `/[clinicSlug]/admin/facturacion`.
 */
import type {
  FacturaDTO,
  RespuestaAnulacion,
  RespuestaCobro,
} from "@/types/billing"
import type {
  AnularFacturaInput,
  EmitirFacturaInput,
  RegistrarPagoInput,
} from "@/lib/validations/billing"
import { consulta, pedir } from "@/lib/api-cliente"
import type { FacturaFiltros } from "@/types/billing"

const BASE = "/api/admin/invoices"

/** Convierte los filtros a query string (omite vacíos y "TODAS"). */
function filtrosAQuery(filtros: Partial<FacturaFiltros>): Record<string, string> {
  const extra: Record<string, string> = {}
  if (filtros.desde) extra.desde = filtros.desde
  if (filtros.hasta) extra.hasta = filtros.hasta
  if (filtros.sedeId) extra.sedeId = filtros.sedeId
  if (filtros.patientId) extra.patientId = filtros.patientId
  if (filtros.q) extra.q = filtros.q
  if (filtros.status && filtros.status !== "TODAS") extra.status = filtros.status
  if (filtros.paymentStatus && filtros.paymentStatus !== "TODAS") {
    extra.paymentStatus = filtros.paymentStatus
  }
  if (filtros.limite) extra.limite = String(filtros.limite)
  return extra
}

/** Lista facturas con filtros (período, sede, estado, paciente, búsqueda). */
export function apiListarFacturas(
  clinicSlug: string,
  filtros: Partial<FacturaFiltros> = {}
) {
  return pedir<{ facturas: FacturaDTO[]; total: number }>(
    `${BASE}?${consulta(clinicSlug, filtrosAQuery(filtros))}`
  )
}

/** Detalle de una factura con su desglose, cobros y notas. */
export function apiObtenerFactura(clinicSlug: string, id: string) {
  return pedir<FacturaDTO>(`${BASE}/${id}?${consulta(clinicSlug)}`)
}

/** Crea y emite la factura (con cobro opcional en el mismo paso). */
export function apiCrearFactura(
  clinicSlug: string,
  factura: EmitirFacturaInput
) {
  return pedir<FacturaDTO>(BASE, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, factura }),
  })
}

/** Registra un cobro (calcula el IGTF del 3% cuando corresponde). */
export function apiRegistrarPago(
  clinicSlug: string,
  facturaId: string,
  pago: RegistrarPagoInput
) {
  return pedir<RespuestaCobro>(`${BASE}/${facturaId}/payments`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, pago }),
  })
}

/** Anula la factura (nota de crédito) o emite un cargo adicional (débito). */
export function apiAnularFactura(
  clinicSlug: string,
  facturaId: string,
  anulacion: AnularFacturaInput
) {
  return pedir<RespuestaAnulacion>(`${BASE}/${facturaId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ clinicSlug, anulacion }),
  })
}
