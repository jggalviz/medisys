/**
 * MEDISYS · Normalización de identidad para el acceso a portales.
 *
 * Módulo PURO (sin "use server") para poder importarse tanto desde Server
 * Actions como desde componentes/handlers sin romper la regla de que los
 * archivos `"use server"` solo exportan funciones async.
 */

/**
 * Normaliza una cédula: elimina prefijos (V-, E-, J-, G-, P-), espacios,
 * puntos, guiones y cualquier carácter no numérico. "V-12.345.678" → "12345678".
 */
export function normalizarCedula(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/^\s*[VEJGP]\s*-?\s*/, "")
    .replace(/\D/g, "")
}

/**
 * Normaliza un teléfono: elimina espacios, guiones y paréntesis; si viene con
 * prefijo internacional 58/+58 conserva los últimos 10 dígitos.
 */
export function normalizarTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, "")
  return digitos.length > 10 ? digitos.slice(-10) : digitos
}
