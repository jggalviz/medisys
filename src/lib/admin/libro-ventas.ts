/**
 * MEDISYS · Libro de Ventas SENIAT (Módulo 3)
 * --------------------------------------------
 * Consulta las facturas, cobros y notas de ajuste del período y arma el
 * reporte oficial con `src/lib/accounting-ve.ts` (motor puro).
 *
 * La consulta se pagina en lotes de 500 para soportar meses con alto volumen
 * sin truncar el libro.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleErrorCode, AdminModuleResult } from "@/types/admin"
import type {
  FormatoExportacion,
  LibroVentasFila,
  LibroVentasReporte,
} from "@/types/accounting"
import type { Database, Invoice } from "@/types/database"
import {
  construirLibroVentas,
  mesActualVenezuela,
  rangoDelMes,
  resumirLibroVentas,
} from "@/lib/accounting-ve"
import { hidratarFacturas, interpretarErrorFacturacion } from "@/lib/admin/facturas"
import { getTasaVigente } from "@/lib/currency-rates"
import { libroVentasFiltrosSchema } from "@/lib/validations/accounting"

type Client = SupabaseClient<Database>

/** Tamaño del lote de facturas leídas por página. */
const TAMANO_LOTE = 500
/** Tope de seguridad para no barrer tablas completas en un rango enorme. */
const MAX_FACTURAS = 5000

type FiltrosLibro = {
  anio?: number | null
  mes?: number | null
  sedeId?: string | null
  formato?: FormatoExportacion | null
}

/**
 * Genera el Libro de Ventas del mes indicado (por defecto, el mes en curso en
 * Venezuela). Devuelve filas + resumen + trazabilidad del período.
 */
export async function generarLibroVentas(
  supabase: Client,
  tenantId: string,
  filtros: FiltrosLibro = {}
): Promise<AdminModuleResult<LibroVentasReporte>> {
  const mesActual = mesActualVenezuela()
  const valido = libroVentasFiltrosSchema.safeParse({
    anio: filtros.anio ?? mesActual.anio,
    mes: filtros.mes ?? mesActual.mes,
    sedeId: filtros.sedeId ?? null,
    formato: filtros.formato ?? "json",
  })

  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const { anio, mes, sedeId } = valido.data
  const { desde, hasta } = rangoDelMes(anio, mes)

  try {
    const filasCrudas: Invoice[] = []

    for (let pagina = 0; pagina * TAMANO_LOTE < MAX_FACTURAS; pagina += 1) {
      const desdeIndice = pagina * TAMANO_LOTE
      const hastaIndice = desdeIndice + TAMANO_LOTE - 1

      let consulta = supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("created_at", `${desde}T00:00:00-04:00`)
        .lte("created_at", `${hasta}T23:59:59-04:00`)
        .order("created_at", { ascending: true })
        .range(desdeIndice, hastaIndice)

      if (sedeId) consulta = consulta.eq("sede_id", sedeId)

      const { data, error } = await consulta
      if (error) {
        const info = interpretarErrorFacturacion(error)
        return { ok: false, code: info.code, message: info.message }
      }

      const lote = (data ?? []) as Invoice[]
      filasCrudas.push(...lote)
      if (lote.length < TAMANO_LOTE) break
    }

    const facturas = await hidratarFacturas(supabase, filasCrudas)
    const filas: LibroVentasFila[] = construirLibroVentas(facturas)
    const tasa = (await getTasaVigente(supabase)).rate
    const resumen = resumirLibroVentas(filas, tasa)

    return {
      ok: true,
      data: {
        anio,
        mes,
        desde,
        hasta,
        generadoEn: new Date().toISOString(),
        tasaReferencia: tasa,
        filas,
        resumen,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al generar el Libro de Ventas.",
    }
  }
}

/** Códigos de error posibles del reporte (re-export para las rutas). */
export type CodigoErrorLibro = AdminModuleErrorCode
