/**
 * MEDISYS · Marca/branding de tenants.
 *
 * Centraliza la validación de `logo_url` para no renderizar assets obsoletos
 * o de terceros (p. ej. el logo antiguo "Santa Inés" cargado en el tenant
 * demo). Cuando el logo no es mostrable, la UI usa el avatar de iniciales.
 */

/** Asset neutro de la plataforma para usos donde se necesita una imagen. */
export const DEMO_LOGO_SRC = "/images/demo-logo.svg"

/** Fragmentos de URL que identifican logos obsoletos / no deseados. */
const PATRONES_LOGO_INVALIDO: RegExp[] = [
  /santa[\s._-]*in[eé]s/i,
  /santaines/i,
  /santa-ines/i,
]

/** ¿La URL de logo es mostrable? (descarta vacíos, "null" y logos obsoletos). */
export function esLogoMostrable(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false
  const limpio = url.trim()
  if (!limpio || limpio === "null" || limpio === "undefined") return false
  return !PATRONES_LOGO_INVALIDO.some((patron) => patron.test(limpio))
}

/** Devuelve la URL saneada o `null` si debe usarse el avatar de iniciales. */
export function logoMostrable(url: string | null | undefined): string | null {
  return esLogoMostrable(url) ? (url as string).trim() : null
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
