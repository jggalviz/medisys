/**
 * MEDISYS · Tasa oficial BCV.
 *
 * Estrategia en cascada (de más fresca a más estable):
 *   1. Scraping en vivo de https://www.bcv.org.ve/ (contenedor `#usd strong`).
 *   2. APIs públicas alternativas (dolarapi.com, pydolarve.org).
 *   3. Última tasa guardada en `bcv_rates` (respaldo manual/BD).
 *   4. Valor hardcodeado `TASA_BCV_FALLBACK`.
 *
 * Las consultas HTTP usan `next: { revalidate: 3600 }` para cachear el
 * resultado una hora y evitar bloqueos por peticiones excesivas.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/** Último recurso si no hay web, API ni fila en `bcv_rates`. */
export const TASA_BCV_FALLBACK = 36.5

/** Segundos de caché para las consultas de la tasa (1 hora). */
export const REVALIDACION_TASA_SEGUNDOS = 3600

export type BcvRateSource =
  | "bcv-web"
  | "dolarapi"
  | "pydolarve"
  | "db"
  | "fallback"

export type BcvRateInfo = {
  tasa: number
  fuente: BcvRateSource
  /** Descripción legible de la fuente usada (para logs/UI). */
  detalle: string
}

/** User-Agent de navegador real (el BCV bloquea clientes sin UA). */
const UA_NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const URL_BCV = "https://www.bcv.org.ve/"
const URL_BCV_TASAS = "https://www.bcv.org.ve/tasas-informativas-sistema-bancario"

type Client = Pick<SupabaseClient<Database>, "from">

/** Extiende RequestInit con la opción de caché de Next.js. */
type InitConRevalidacion = RequestInit & {
  next?: { revalidate?: number | false }
}

/** Convierte un precio USD a Bolívares usando la tasa recibida. */
export function convertirADolares(usd: number, tasaBCV: number): number {
  return usd * tasaBCV
}

/** Normaliza "36,50" / "36.50" / 36.5 a número positivo (o null). */
export function parsearTasaBcv(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  const limpio = String(valor)
    .replace(/\s|\u00a0/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "")
  if (!limpio) return null
  const numero = Number(limpio)
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : null
}

/**
 * Extrae la tasa del dólar oficial desde el HTML del BCV.
 *
 * Marcado real de bcv.org.ve (verificado): etiqueta `USD` seguida de
 * `<strong>832,48830000</strong>` dentro del recuadro del día. Además se
 * contemplan variantes históricas (`id="usd"`, bloque "Dólar").
 */
export function extraerTasaHTMLBCV(html: string): number | null {
  const compacto = html.replace(/\s+/g, " ")
  const patrones = [
    // Markup actual: label USD → <strong>valor</strong>.
    /\bUSD\b[\s\S]{0,300}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i,
    // Variantes con contenedor #usd (rediseños que reutilicen el id).
    /id=["']usd["'][\s\S]{0,900}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i,
    // Valor antes del label USD.
    /<strong[^>]*>\s*([\d.,]+)\s*<\/strong>[\s\S]{0,120}?(?:<\/div>\s*)?<div[^>]*>\s*USD/i,
    // Último recurso: primer número tras la palabra "Dólar".
    /d[óo]lar[\s\S]{0,600}?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  ]

  for (const patron of patrones) {
    const coincidencia = compacto.match(patron)
    if (!coincidencia) continue
    const tasa = parsearTasaBcv(coincidencia[1])
    if (tasa) return tasa
  }
  return null
}

/** `fetch` con UA de navegador, timeout y caché de revalidación de Next. */
async function pedirConCache(
  url: string,
  revalidate: number,
  timeoutMs = 10_000
): Promise<Response> {
  const init: InitConRevalidacion = {
    headers: {
      "User-Agent": UA_NAVEGADOR,
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-VE,es;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate },
  }
  return fetchConReintentoTls(url, init)
}

/**
 * ¿Se permite reintentar sin verificación TLS? Solo en servidor y mientras no
 * se fuerce estrictamente con `BCV_TLS_ESTRICTO=1`.
 */
function permitirTlsLaxo(): boolean {
  if (typeof window !== "undefined") return false
  return process.env.BCV_TLS_ESTRICTO !== "1"
}

/**
 * El portal del BCV publica una cadena de certificados incompleta
 * (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), por lo que `fetch` estricto de Node
 * falla aunque el sitio esté arriba. Si el primer intento lanza, se reintenta
 * desactivando la verificación TLS de forma temporal y se restaura el valor
 * previo de la variable (solo lado servidor).
 */
async function fetchConReintentoTls(
  url: string,
  init: InitConRevalidacion
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (!permitirTlsLaxo()) throw error

    const previo = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    try {
      return await fetch(url, init)
    } finally {
      if (previo === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = previo
      }
    }
  }
}

/** Fuentes HTML oficiales (scraping del portal del BCV). */
const FUENTES_HTML: { url: string; detalle: string }[] = [
  { url: URL_BCV, detalle: "bcv.org.ve (#usd)" },
  { url: URL_BCV_TASAS, detalle: "bcv.org.ve/tasas-informativas" },
]

/** APIs públicas alternativas cuando el BCV no responde o bloquea la IP. */
const FUENTES_API: { url: string; fuente: BcvRateSource; detalle: string }[] = [
  {
    url: "https://ve.dolarapi.com/v1/dolares/oficial",
    fuente: "dolarapi",
    detalle: "ve.dolarapi.com (BCV oficial)",
  },
  {
    url: "https://dolarapi.com/v1/dolares/oficial",
    fuente: "dolarapi",
    detalle: "dolarapi.com (BCV oficial)",
  },
  {
    url: "https://pydolarve.org/api/v1/dollar?page=bcv",
    fuente: "pydolarve",
    detalle: "pydolarve.org (BCV)",
  },
]

/** Intenta el scraping del portal oficial del BCV. */
async function consultarBcvWeb(): Promise<BcvRateInfo | null> {
  for (const fuente of FUENTES_HTML) {
    try {
      const respuesta = await pedirConCache(
        fuente.url,
        REVALIDACION_TASA_SEGUNDOS
      )
      if (!respuesta.ok) continue
      const html = await respuesta.text()
      const tasa = extraerTasaHTMLBCV(html)
      if (tasa) return { tasa, fuente: "bcv-web", detalle: fuente.detalle }
    } catch {
      // Fuente no disponible: se intenta la siguiente.
    }
  }
  return null
}

/** Extrae la tasa de los JSON de las APIs alternativas (formatos variados). */
function tasaDesdeJson(json: Record<string, unknown>): number | null {
  const monitors = json.monitors as Record<string, unknown> | undefined
  const usdMonitor = monitors?.usd as Record<string, unknown> | undefined
  const candidatos = [
    json.venta,
    json.promedio,
    json.transferencia,
    json.compra,
    json.price,
    usdMonitor?.price,
  ]
  for (const candidato of candidatos) {
    const tasa = parsearTasaBcv(candidato)
    if (tasa) return tasa
  }
  return null
}

/** Intenta las APIs públicas alternativas. */
async function consultarApisAlternativas(): Promise<BcvRateInfo | null> {
  const revalidate = Math.floor(REVALIDACION_TASA_SEGUNDOS / 2)
  for (const fuente of FUENTES_API) {
    try {
      const respuesta = await pedirConCache(fuente.url, revalidate, 8_000)
      if (!respuesta.ok) continue
      const json = (await respuesta.json()) as Record<string, unknown>
      const tasa = tasaDesdeJson(json)
      if (tasa) return { tasa, fuente: fuente.fuente, detalle: fuente.detalle }
    } catch {
      // API no disponible: se intenta la siguiente.
    }
  }
  return null
}

/** Tasa en vivo (portal BCV → APIs alternativas). `null` si todo falla. */
export async function obtenerTasaBcvEnVivo(): Promise<BcvRateInfo | null> {
  return (await consultarBcvWeb()) ?? (await consultarApisAlternativas())
}

/**
 * Última tasa guardada en `bcv_rates` (respaldo manual). Tolera `tasa`/`rate`
 * y nunca lanza: devuelve `null` si no hay filas o la consulta falla.
 */
export async function leerTasaBcvDb(supabase: Client): Promise<number | null> {
  try {
    // Sin `.single()`: procesa el array para evitar "Cannot coerce the result".
    const { data } = await supabase
      .from("bcv_rates")
      .select("*")
      .order("fetched_at", { ascending: false })
      .limit(1)

    const fila = (data ?? [])[0] as
      | (Partial<Record<string, unknown>> & { tasa?: unknown; rate?: unknown })
      | undefined
    if (!fila) return null

    return parsearTasaBcv(fila.tasa ?? fila.rate)
  } catch {
    return null
  }
}

/**
 * Tasa para componentes cliente (o contextos sin red externa): solo consulta
 * `bcv_rates` y cae al valor hardcodeado. Evita fetches cross-origin en el
 * navegador (CORS) y bloqueos del portal del BCV.
 */
export async function getLatestBcvRateDesdeDb(supabase: Client): Promise<number> {
  return (await leerTasaBcvDb(supabase)) ?? TASA_BCV_FALLBACK
}

/**
 * Cascada completa con la fuente usada:
 * portal BCV (scraping) → APIs alternativas → `bcv_rates` → hardcodeado.
 * Nunca lanza.
 */
export async function getLatestBcvRateDetallada(
  supabase: Client
): Promise<BcvRateInfo> {
  const enVivo = await obtenerTasaBcvEnVivo()
  if (enVivo) return enVivo

  const enDb = await leerTasaBcvDb(supabase)
  if (enDb) {
    return { tasa: enDb, fuente: "db", detalle: "bcv_rates (última guardada)" }
  }

  return {
    tasa: TASA_BCV_FALLBACK,
    fuente: "fallback",
    detalle: `valor de respaldo (${TASA_BCV_FALLBACK})`,
  }
}

/**
 * Lee la tasa BCV vigente (web → API → BD → fallback). Nunca lanza.
 * Firma mantenida para los Server Actions y páginas que ya la consumen.
 */
export async function getLatestBcvRate(supabase: Client): Promise<number> {
  return (await getLatestBcvRateDetallada(supabase)).tasa
}

