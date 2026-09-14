/**
 * MEDISYS · Motor de tasa oficial BCV y multimoneda (`currency_rates`)
 * ---------------------------------------------------------------------
 * Reglas:
 *  1. Una tasa MANUAL vigente siempre tiene prioridad (la fijó el admin).
 *  2. Si `auto_update` está activo y la tasa del día no está guardada, se
 *     consulta la cascada del BCV (`@/lib/bcv`) y se persiste el resultado.
 *  3. Si todo falla, se conserva la última tasa guardada y, en último caso,
 *     el valor de respaldo (`TASA_BCV_FALLBACK`).
 *
 * Ninguna función lanza: todas devuelven `AdminModuleResult` o valores con
 * respaldo, para que las API y la UI puedan mostrar un estado coherente.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleResult, TasaBcv, TasaRegistro } from "@/types/admin"
import type { CurrencyCode, CurrencyRate, Database } from "@/types/database"
import { obtenerTasaBcvEnVivo, TASA_BCV_FALLBACK } from "@/lib/bcv"
import { fechaHoyVenezuela } from "@/lib/date"
import { redondear2 } from "@/lib/fiscal-ve"
import { tasaBcvSchema } from "@/lib/validations/admin"

type Client = SupabaseClient<Database>
type ErrorBd = { code?: string; message?: string } | null

/** Fuente de una tasa fijada manualmente por el administrador. */
export const FUENTE_MANUAL = "MANUAL"
/** Fuente de la tasa obtenida de la cascada oficial del BCV. */
export const FUENTE_BCV = "BCV"

/** Códigos de PostgREST/Postgres cuando la tabla aún no existe (0016). */
function esTablaAusente(error: ErrorBd): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

function mensajeBd(error: ErrorBd, accion: string): string {
  if (esTablaAusente(error)) {
    return `Falta aplicar la migración 0016_admin_module.sql en la base de datos (tabla currency_rates ${accion}).`
  }
  return `No se pudo ${accion}: ${error?.message ?? "error desconocido"}.`
}

function esFuenteManual(source: string): boolean {
  return source.trim().toUpperCase().startsWith(FUENTE_MANUAL)
}

/** Redondeo de tasas a 4 decimales (precisión `numeric(18,4)`). */
function redondear4(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10_000) / 10_000
}

/** Convierte una fila de BD al DTO que consumen API y UI. */
function aDto(fila: CurrencyRate, extra: Partial<TasaBcv> = {}): TasaBcv {
  return {
    currency: fila.currency,
    rate: Number(fila.rate),
    effectiveDate: fila.effective_date,
    source: fila.source,
    autoUpdate: Boolean(fila.auto_update),
    origen: esFuenteManual(fila.source) ? "manual" : "bcv",
    detalle: esFuenteManual(fila.source)
      ? `Tasa manual registrada el ${fila.effective_date}`
      : `Tasa BCV del ${fila.effective_date}`,
    actualizadoEn: fila.updated_at ?? fila.created_at ?? null,
    ...extra,
  }
}

/* ------------------------------------------------------------------ */
/* Lecturas                                                            */
/* ------------------------------------------------------------------ */

/** Última tasa registrada para la moneda (o `null` si no hay/migración). */
export async function leerTasaGuardada(
  supabase: Client,
  currency: CurrencyCode = "USD"
): Promise<CurrencyRate | null> {
  try {
    const { data, error } = await supabase
      .from("currency_rates")
      .select("*")
      .eq("currency", currency)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) return null
    return (data ?? [])[0] ?? null
  } catch {
    return null
  }
}

/** Registro histórico de tasa (DTO camelCase para API/UI). */
export type RegistroTasa = TasaRegistro

function aRegistroTasa(fila: CurrencyRate): RegistroTasa {
  return {
    id: fila.id,
    currency: fila.currency,
    rate: Number(fila.rate),
    effectiveDate: fila.effective_date,
    source: fila.source,
    autoUpdate: Boolean(fila.auto_update),
    actualizadoEn: fila.updated_at ?? fila.created_at ?? null,
  }
}

/** Historial de tasas (auditoría y gráficos) ya normalizado a DTO. */
export async function historialTasas(
  supabase: Client,
  opciones: { currency?: CurrencyCode; limite?: number } = {}
): Promise<RegistroTasa[]> {
  const { currency = "USD", limite = 12 } = opciones
  try {
    const { data, error } = await supabase
      .from("currency_rates")
      .select("*")
      .eq("currency", currency)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limite, 1), 100))

    if (error) return []
    return (data ?? []).map(aRegistroTasa)
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Escrituras                                                          */
/* ------------------------------------------------------------------ */

type EntradaTasa = {
  currency: CurrencyCode
  rate: number
  effectiveDate: string
  source: string
  autoUpdate: boolean
  createdBy?: string | null
}

/**
 * UPSERT de una tasa. Devuelve `null` si la tabla no existe o si RLS lo impide
 * (p. ej. el cron anónimo), sin interrumpir el flujo del llamador.
 */
async function persistirTasa(
  supabase: Client,
  entrada: EntradaTasa
): Promise<CurrencyRate | null> {
  try {
    const { data, error } = await supabase
      .from("currency_rates")
      .upsert(
        {
          currency: entrada.currency,
          rate: entrada.rate,
          effective_date: entrada.effectiveDate,
          source: entrada.source,
          auto_update: entrada.autoUpdate,
          created_by: entrada.createdBy ?? null,
        },
        { onConflict: "currency,effective_date,source" }
      )
      .select("*")
      .maybeSingle()

    if (error) {
      console.warn("[currency-rates] No se pudo persistir la tasa:", error.message)
      return null
    }
    return data ?? null
  } catch (cause) {
    console.warn(
      "[currency-rates] Error inesperado al persistir la tasa:",
      cause instanceof Error ? cause.message : cause
    )
    return null
  }
}

/**
 * Registra (o sobreescribe) la tasa del administrador para una fecha.
 * Es el "override manual" del motor: `source = MANUAL`.
 */
export async function registrarTasaManual(
  supabase: Client,
  entrada: unknown,
  opciones: { createdBy?: string | null } = {}
): Promise<AdminModuleResult<CurrencyRate>> {
  const valido = tasaBcvSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }

  const { currency, rate, effectiveDate, autoUpdate } = valido.data

  const { data, error } = await supabase
    .from("currency_rates")
    .upsert(
      {
        currency,
        rate: redondear4(rate),
        effective_date: effectiveDate,
        source: FUENTE_MANUAL,
        auto_update: autoUpdate,
        created_by: opciones.createdBy ?? null,
      },
      { onConflict: "currency,effective_date,source" }
    )
    .select("*")
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      code: esTablaAusente(error) ? "MIGRACION_PENDIENTE" : "SERVER_ERROR",
      message: mensajeBd(error, "guardar la tasa manual"),
    }
  }

  if (!data) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "La tasa no se guardó: tu usuario no tiene permisos de administrador sobre las tasas.",
    }
  }

  return { ok: true, data }
}

/**
 * Fuerza la consulta a la cascada del BCV y persiste el resultado del día.
 * Si el BCV no responde, devuelve la última tasa guardada como respaldo.
 */
export async function refrescarTasaBcv(
  supabase: Client,
  opciones: { currency?: CurrencyCode } = {}
): Promise<AdminModuleResult<TasaBcv>> {
  const { currency = "USD" } = opciones
  const hoy = fechaHoyVenezuela()
  const enVivo = await obtenerTasaBcvEnVivo()

  if (!enVivo) {
    const respaldo = await leerTasaGuardada(supabase, currency)
    if (respaldo) {
      return {
        ok: true,
        data: aDto(respaldo, {
          origen: "respaldo",
          detalle:
            "No se pudo contactar al BCV. Se conserva la última tasa guardada.",
        }),
      }
    }
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        "No se pudo obtener la tasa del BCV y no hay una tasa guardada como respaldo.",
    }
  }

  const persistida = await persistirTasa(supabase, {
    currency,
    rate: redondear4(enVivo.tasa),
    effectiveDate: hoy,
    source: FUENTE_BCV,
    autoUpdate: true,
  })

  return {
    ok: true,
    data: {
      currency,
      rate: enVivo.tasa,
      effectiveDate: hoy,
      source: FUENTE_BCV,
      autoUpdate: true,
      origen: "bcv",
      detalle: enVivo.detalle,
      actualizadoEn: persistida?.updated_at ?? null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Lectura "vigente" con cascada y conversión                          */
/* ------------------------------------------------------------------ */

/**
 * Tasa vigente del sistema aplicando las reglas del motor (nunca lanza).
 * `origen` indica de dónde salió: manual, BCV (en vivo o guardada) o respaldo.
 */
export async function getTasaVigente(
  supabase: Client,
  opciones: { currency?: CurrencyCode } = {}
): Promise<TasaBcv> {
  const { currency = "USD" } = opciones
  const hoy = fechaHoyVenezuela()
  const guardada = await leerTasaGuardada(supabase, currency)

  // 1) Override manual vigente: el administrador manda.
  if (guardada && esFuenteManual(guardada.source)) {
    return aDto(guardada, {
      origen: "manual",
      detalle: `Tasa fijada manualmente (${guardada.source}) el ${guardada.effective_date}`,
    })
  }

  // 2) Tasa oficial ya guardada del día.
  if (guardada && guardada.effective_date === hoy) {
    return aDto(guardada)
  }

  // 3) Sin tasa del día: se refresca en vivo si la actualización está activa.
  if (!guardada || guardada.auto_update) {
    const enVivo = await obtenerTasaBcvEnVivo()
    if (enVivo) {
      const persistida = await persistirTasa(supabase, {
        currency,
        rate: redondear4(enVivo.tasa),
        effectiveDate: hoy,
        source: FUENTE_BCV,
        autoUpdate: true,
      })
      return {
        currency,
        rate: enVivo.tasa,
        effectiveDate: hoy,
        source: persistida?.source ?? FUENTE_BCV,
        autoUpdate: true,
        origen: enVivo.fuente === "db" ? "respaldo" : "bcv",
        detalle: enVivo.detalle,
        actualizadoEn: persistida?.updated_at ?? guardada?.updated_at ?? null,
      }
    }
  }

  // 4) Última tasa guardada (auto-actualización desactivada o BCV caído).
  if (guardada) {
    return aDto(guardada, {
      origen: "respaldo",
      detalle: `Última tasa guardada del ${guardada.effective_date}. El BCV no respondió o la actualización automática está desactivada.`,
    })
  }

  // 5) Valor de respaldo del sistema.
  return {
    currency,
    rate: TASA_BCV_FALLBACK,
    effectiveDate: hoy,
    source: "FALLBACK",
    autoUpdate: false,
    origen: "respaldo",
    detalle: `Valor de respaldo del sistema (${TASA_BCV_FALLBACK}). Aplica la migración 0016 o registra la tasa manualmente.`,
    actualizadoEn: null,
  }
}

/**
 * Convierte un monto entre monedas usando la tasa (Bs por USD).
 * Devuelve 0 si la tasa no es válida, para no propagar `Infinity`/`NaN`.
 */
export function convertirMoneda(
  monto: number,
  de: CurrencyCode,
  a: CurrencyCode,
  tasa: number
): number {
  if (!Number.isFinite(monto)) return 0
  if (de === a) return redondear2(monto)
  if (!Number.isFinite(tasa) || tasa <= 0) return 0
  return redondear2(de === "USD" ? monto * tasa : monto / tasa)
}


