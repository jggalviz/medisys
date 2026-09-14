/**
 * MEDISYS · Primitivas de validación (compatibles con Zod)
 * ---------------------------------------------------------
 * Núcleo compartido por los esquemas de cada módulo:
 *   - `src/lib/validations/admin.ts`   (Módulo 1: fiscal, sedes, catálogo)
 *   - `src/lib/validations/billing.ts` (Módulo 2: facturación y cobros)
 *
 * El proyecto usa Supabase + Postgres como fuente de verdad del esquema y no
 * incluye Zod como dependencia: este módulo ofrece la misma ergonomía
 * (`safeParse` / `parse` / `error.issues`) sin dependencias externas. Si más
 * adelante se adopta Zod, basta reemplazar la clase `Esquema` y sus ayudantes.
 *
 * Módulo puro (sin acceso a red ni a Supabase): seguro para componentes
 * cliente, Server Actions y Route Handlers.
 */
import type { CampoIssue } from "@/types/admin"
import { FECHA_ISO_REGEX } from "@/lib/fiscal-ve"
import { fechaHoyVenezuela, isValidDateISO } from "@/lib/date"

export type ErrorValidacion = { message: string; issues: CampoIssue[] }

export type ResultadoValidacion<T> =
  | { success: true; data: T }
  | { success: false; error: ErrorValidacion }

export type Validador<T> = (entrada: unknown) => ResultadoValidacion<T>

/** Error lanzado por `parse()` cuando la entrada no es válida. */
export class ErrorValidacionFormulario extends Error {
  readonly issues: CampoIssue[]

  constructor(error: ErrorValidacion) {
    super(error.message)
    this.name = "ErrorValidacionFormulario"
    this.issues = error.issues
  }
}

/** Esquema tipado: envuelve un validador puro con la API de Zod. */
export class Esquema<T> {
  private readonly validador: Validador<T>

  constructor(validador: Validador<T>) {
    this.validador = validador
  }

  safeParse(entrada: unknown): ResultadoValidacion<T> {
    return this.validador(entrada)
  }

  /** Igual que `safeParse` pero lanza `ErrorValidacionFormulario`. */
  parse(entrada: unknown): T {
    const resultado = this.validador(entrada)
    if (!resultado.success) throw new ErrorValidacionFormulario(resultado.error)
    return resultado.data
  }
}

export function crearEsquema<T>(validador: Validador<T>): Esquema<T> {
  return new Esquema(validador)
}

/* ------------------------------------------------------------------ */
/* Acumulador de incidencias                                          */
/* ------------------------------------------------------------------ */

/** Contexto mutable compartido por los validadores de un mismo esquema. */
export type Contexto = { issues: CampoIssue[] }

export function error(ctx: Contexto): ErrorValidacion {
  return {
    message: ctx.issues[0]?.mensaje ?? "Datos inválidos.",
    issues: ctx.issues,
  }
}

export function comoObjeto(entrada: unknown): Record<string, unknown> {
  return entrada && typeof entrada === "object" && !Array.isArray(entrada)
    ? (entrada as Record<string, unknown>)
    : {}
}

export function comoTexto(valor: unknown): string {
  if (typeof valor === "string") return valor
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor)
  return ""
}

/** Arreglo de valores sin duplicados (útil para ids de sedes/ítems). */
export function comoArreglo(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}

/* ------------------------------------------------------------------ */
/* Campos escalares                                                   */
/* ------------------------------------------------------------------ */

/** Texto obligatorio: recorta, colapsa espacios y valida longitud. */
export function textoRequerido(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { min?: number; max?: number } = {}
): string {
  const { min = 1, max = 200 } = limites
  const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
  if (limpio.length < min) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} es obligatorio (mínimo ${min} caracteres).`,
    })
  } else if (limpio.length > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} no puede superar ${max} caracteres.`,
    })
  }
  return limpio
}

/** Texto opcional: vacío/null → `null`. */
export function textoOpcional(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { max?: number } = {}
): string | null {
  const { max = 200 } = limites
  const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
  if (!limpio) return null
  if (limpio.length > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} no puede superar ${max} caracteres.`,
    })
  }
  return limpio
}

/** Número decimal obligatorio (acepta "36,50" y "36.50"). */
export function decimalRequerido(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { min?: number; max?: number; decimales?: number } = {}
): number {
  const { min = 0, max = 1_000_000, decimales = 2 } = limites
  const numero = Number(comoTexto(valor).replace(",", ".").trim())
  if (!Number.isFinite(numero)) {
    ctx.issues.push({ campo, mensaje: `${etiqueta} debe ser un número válido.` })
    return 0
  }
  if (numero < min || numero > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe estar entre ${min} y ${max}.`,
    })
    return min
  }
  const factor = 10 ** decimales
  return Math.round(numero * factor) / factor
}

/** Entero positivo (cantidades, correlativos). */
export function enteroRequerido(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { min?: number; max?: number } = {}
): number {
  const { min = 1, max = 100_000 } = limites
  const numero = Math.trunc(Number(comoTexto(valor).trim()))
  if (!Number.isFinite(numero) || numero < min || numero > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe ser un número entero entre ${min} y ${max}.`,
    })
    return min
  }
  return numero
}

/** Booleano tolerante (acepta `true`/`false`, `1`/`0`, `"true"`/`"false"`). */
export function booleano(valor: unknown, porDefecto: boolean): boolean {
  if (typeof valor === "boolean") return valor
  if (valor === "true" || valor === 1 || valor === "1") return true
  if (valor === "false" || valor === 0 || valor === "0") return false
  return porDefecto
}

/** Valor perteneciente a un catálogo cerrado (case-insensitive). */
export function enumerado<T extends string>(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  permitidos: readonly T[],
  porDefecto: T | null
): T {
  const limpio = comoTexto(valor).trim().toUpperCase()
  const encontrado = permitidos.find((item) => item === limpio)
  if (encontrado) return encontrado
  if (porDefecto !== null) return porDefecto
  ctx.issues.push({
    campo,
    mensaje: `${etiqueta} debe ser uno de: ${permitidos.join(", ")}.`,
  })
  return permitidos[0]
}

/** Fecha 'YYYY-MM-DD' obligatoria (usa hoy en Venezuela si viene vacía). */
export function fechaRequerida(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown
): string {
  const limpio = comoTexto(valor).trim()
  if (!limpio) return fechaHoyVenezuela()
  if (!FECHA_ISO_REGEX.test(limpio) || !isValidDateISO(limpio)) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe ser una fecha válida (YYYY-MM-DD).`,
    })
  }
  return limpio
}

/** UUID opcional (devuelve `null` si viene vacío). */
export function uuidOpcional(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown
): string | null {
  const limpio = comoTexto(valor).trim()
  if (!limpio) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpio)) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe ser un identificador válido.`,
    })
    return null
  }
  return limpio
}
