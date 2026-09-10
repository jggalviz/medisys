/**
 * MEDISYS · Marca/branding de tenants.
 *
 * Centraliza la validación de `logo_url` para no renderizar assets obsoletos
 * o de terceros (p. ej. el logo antiguo "Santa Inés" cargado en el tenant
 * demo). Cuando el logo no es mostrable, la UI usa el avatar de iniciales.
 */

/** Asset neutro de la plataforma para usos donde se necesita una imagen. */
export const DEMO_LOGO_SRC = "/images/demo-logo.svg"

/**
 * Términos que invalidan una imagen de marca (activos obsoletos de terceros,
 * p. ej. el logo "Santa Inés" sembrado en el tenant demo). La comprobación es
 * por CONTENIDO del string, sin distinguir mayúsculas ni acentos.
 */
const TERMINOS_LOGO_INVALIDO = ["santa", "santaines", "ines"] as const

/** Patrones redundantes (variantes con separadores/acentos). */
const PATRONES_LOGO_INVALIDO: RegExp[] = [
  /santa[\s._-]*(?:i|í)n(?:e|é)s/i,
  /santaines/i,
  /santa-ines/i,
]

/** Quita acentos y pasa a minúsculas para comparar términos. */
function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/** ¿La URL de logo es mostrable? (descarta vacíos, "null" y logos obsoletos). */
export function esLogoMostrable(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false
  const limpio = url.trim()
  if (!limpio || limpio === "null" || limpio === "undefined") return false

  const comparacion = normalizarTexto(limpio)
  if (TERMINOS_LOGO_INVALIDO.some((termino) => comparacion.includes(termino))) {
    return false
  }
  return !PATRONES_LOGO_INVALIDO.some((patron) => patron.test(limpio))
}

/** Devuelve la URL saneada o `null` si debe usarse el avatar de iniciales. */
export function logoMostrable(url: string | null | undefined): string | null {
  return esLogoMostrable(url) ? (url as string).trim() : null
}

/**
 * Alias para cualquier imagen de marca del tenant o de sus especialistas
 * (logo de la clínica, foto de un doctor, etc.). Fuerza `null` ante assets
 * obsoletos para que la UI use iniciales o `/images/demo-logo.svg`.
 */
export function imagenMostrable(url: string | null | undefined): string | null {
  return logoMostrable(url)
}

/** Iniciales para el avatar de respaldo (máximo 2 letras). */
export function inicialesTenant(nombre: string | null | undefined): string {
  const limpio = (nombre ?? "").trim()
  if (!limpio) return "MD"
  return (
    limpio
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join("") || "MD"
  )
}
