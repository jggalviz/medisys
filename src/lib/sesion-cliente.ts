"use client"

/**
 * MEDISYS · Consulta de la sesión activa desde el cliente (header público).
 * ---------------------------------------------------------------
 * La landing es estática (ISR), así que el header no puede resolver la sesión
 * en el servidor sin volverla dinámica. En su lugar consulta una sola vez
 * `GET /api/sesion`:
 *
 *  - el resultado se comparte entre todas las instancias del header mediante
 *    una promesa a nivel de módulo (una única petición por carga de página),
 *  - `invalidarSesionHeader()` la descarta al cerrar sesión para que el header
 *    vuelva a consultar (evita mostrar el escritorio a un usuario deslogueado).
 */
import type { SesionHeader } from "@/lib/destinos-sesion"

let consulta: Promise<SesionHeader | null> | null = null

/** Consulta (o reutiliza) la sesión del visitante. Nunca rechaza. */
export function pedirSesionHeader(): Promise<SesionHeader | null> {
  consulta ??= fetch("/api/sesion", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
    .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
    .then((json: { sesion?: SesionHeader | null } | null) => json?.sesion ?? null)
    .catch(() => null)

  return consulta
}

/** Descarta la sesión cacheada (se usa al cerrar sesión). */
export function invalidarSesionHeader(): void {
  consulta = null
}
