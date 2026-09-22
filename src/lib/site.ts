/**
 * MEDISYS · Datos del sitio público (módulo puro).
 *
 * Centraliza el dominio con el que se muestran los enlaces públicos de cada
 * consultorio (`medisys.com.ve/dr-perez`). Coincide con el `metadataBase` del
 * layout raíz (`src/app/layout.tsx`).
 */

/** Dominio público del producto. */
export const URL_SITIO_PUBLICO = "https://medisys.com.ve"

/** Ruta interna de la página pública de un consultorio. */
export function rutaPublica(slug: string): string {
  return `/${String(slug ?? "").trim()}`
}

/** Enlace público absoluto de un consultorio (para mostrar/copiar). */
export function enlacePublico(slug: string): string {
  return `${URL_SITIO_PUBLICO}${rutaPublica(slug)}`
}
