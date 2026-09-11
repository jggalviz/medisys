/**
 * MEDISYS · Utilidades de slug (módulo puro).
 * Vive fuera de los archivos "use server" porque Next exige que esos archivos
 * solo exporten funciones async.
 */

/** Convierte un texto en slug URL-friendly (máx. 80 caracteres). */
export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
