"use client"

/**
 * MEDISYS · Cliente HTTP del Módulo 3 (Contabilidad y cuadre de caja)
 * ===================================================================
 * Envuelve `/api/admin/reports/sales-book`, `/api/admin/closings` y
 * `/api/admin/settlements` con tipos y errores normalizados para la UI de
 * `/[clinicSlug]/admin/contabilidad`.
 */
import type {
  CierreCajaDTO,
  LibroVentasReporte,
  LiquidacionDTO,
  LiquidacionPreview,
  RespuestaCierre,
} from "@/types/accounting"
import type {
  ActualizarCierreInput,
  ActualizarLiquidacionInput,
  CierreCajaInput,
  CrearLiquidacionInput,
  LibroVentasFiltrosInput,
} from "@/lib/validations/accounting"
import { consulta, pedir } from "@/lib/api-cliente"

/** Filtros del histórico de cierres (query string). */
export type CierresQuery = {
  sedeId?: string | null
  status?: string | null
  desde?: string | null
  hasta?: string | null
  fecha?: string | null
  limite?: number
}

/** Filtros del listado de liquidaciones (query string). */
export type LiquidacionesQuery = {
  doctorId?: string | null
  status?: string | null
  desde?: string | null
  hasta?: string | null
  limite?: number
}

function aQuery(entrada: Record<string, string | number | null | undefined>) {
  const extra: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(entrada)) {
    if (valor === null || valor === undefined || valor === "") continue
    extra[clave] = String(valor)
  }
  return extra
}

/* ----------------------- Libro de Ventas SENIAT --------------------- */

export function apiLibroVentas(
  clinicSlug: string,
  filtros: Omit<LibroVentasFiltrosInput, "formato">
) {
  return pedir<LibroVentasReporte>(
    `/api/admin/reports/sales-book?${consulta(
      clinicSlug,
      aQuery({
        anio: filtros.anio,
        mes: filtros.mes,
        sedeId: filtros.sedeId,
      })
    )}`
  )
}

/** URL de descarga directa del CSV (mantiene la sesión por cookie). */
export function urlLibroVentasCsv(
  clinicSlug: string,
  filtros: Omit<LibroVentasFiltrosInput, "formato">
): string {
  return `/api/admin/reports/sales-book?${consulta(
    clinicSlug,
    aQuery({
      anio: filtros.anio,
      mes: filtros.mes,
      sedeId: filtros.sedeId,
      formato: "csv",
    })
  )}`
}

/* --------------------------- Cierres de caja ------------------------ */

export function apiListarCierres(clinicSlug: string, query: CierresQuery = {}) {
  return pedir<{
    cierres: CierreCajaDTO[]
    total: number
    arqueo: RespuestaCierre["arqueo"] | null
    arqueoAviso: string | null
  }>(`/api/admin/closings?${consulta(clinicSlug, aQuery({ ...query }))}`)
}

export function apiGuardarCierre(clinicSlug: string, cierre: CierreCajaInput) {
  return pedir<RespuestaCierre>("/api/admin/closings", {
    method: "POST",
    body: JSON.stringify({ clinicSlug, cierre }),
  })
}

export function apiActualizarCierre(
  clinicSlug: string,
  cierreId: string,
  entrada: ActualizarCierreInput
) {
  return pedir<CierreCajaDTO>(`/api/admin/closings/${cierreId}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, ...entrada }),
  })
}

/* --------------------- Liquidaciones de honorarios ------------------ */

export function apiListarLiquidaciones(
  clinicSlug: string,
  query: LiquidacionesQuery = {}
) {
  return pedir<{ liquidaciones: LiquidacionDTO[]; total: number }>(
    `/api/admin/settlements?${consulta(clinicSlug, aQuery({ ...query }))}`
  )
}

export function apiPreviewLiquidacion(
  clinicSlug: string,
  opciones: { doctorId: string; desde: string; hasta: string }
) {
  return pedir<LiquidacionPreview>(
    `/api/admin/settlements?${consulta(
      clinicSlug,
      aQuery({ preview: "1", ...opciones })
    )}`
  )
}

export function apiGenerarLiquidacion(
  clinicSlug: string,
  liquidacion: CrearLiquidacionInput
) {
  return pedir<LiquidacionDTO>("/api/admin/settlements", {
    method: "POST",
    body: JSON.stringify({ clinicSlug, liquidacion }),
  })
}

export function apiActualizarLiquidacion(
  clinicSlug: string,
  liquidacionId: string,
  entrada: ActualizarLiquidacionInput
) {
  return pedir<LiquidacionDTO>(`/api/admin/settlements/${liquidacionId}`, {
    method: "PATCH",
    body: JSON.stringify({ clinicSlug, ...entrada }),
  })
}
