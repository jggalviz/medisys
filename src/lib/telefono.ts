/**
 * MEDISYS · Teléfonos internacionales (prefijo de país + número nacional).
 *
 * Módulo PURO (servidor + cliente): el formulario de registro valida en tiempo
 * real y la Server Action revalida con estas mismas reglas.
 *
 * Formato de salida (E.164 sin separadores): `+58` + `4121234567` →
 * `+584121234567`. Se elimina el cero inicial del formato nacional (0412…).
 */

export type PrefijoPais = {
  /** Código telefónico sin el `+` (ej. '58'). */
  codigo: string
  /** Nombre del país mostrado en el selector. */
  pais: string
  /** Bandera del selector (identificador regional Unicode). */
  bandera: string
}

/** Venezuela: prefijo por defecto del registro. */
export const PREFIJO_POR_DEFECTO = "58"

/**
 * Prefijos disponibles en el selector. Venezuela primero (mercado principal) y
 * después los países con mayor presencia de la diáspora y de clientes de la
 * región.
 */
export const PREFIJOS_PAIS: readonly PrefijoPais[] = [
  { codigo: "58", pais: "Venezuela", bandera: "🇻🇪" },
  { codigo: "57", pais: "Colombia", bandera: "🇨🇴" },
  { codigo: "1", pais: "Estados Unidos / Canadá", bandera: "🇺🇸" },
  { codigo: "34", pais: "España", bandera: "🇪🇸" },
  { codigo: "51", pais: "Perú", bandera: "🇵🇪" },
  { codigo: "56", pais: "Chile", bandera: "🇨🇱" },
  { codigo: "54", pais: "Argentina", bandera: "🇦🇷" },
  { codigo: "52", pais: "México", bandera: "🇲🇽" },
  { codigo: "593", pais: "Ecuador", bandera: "🇪🇨" },
  { codigo: "591", pais: "Bolivia", bandera: "🇧🇴" },
  { codigo: "595", pais: "Paraguay", bandera: "🇵🇾" },
  { codigo: "598", pais: "Uruguay", bandera: "🇺🇾" },
  { codigo: "55", pais: "Brasil", bandera: "🇧🇷" },
  { codigo: "507", pais: "Panamá", bandera: "🇵🇦" },
  { codigo: "506", pais: "Costa Rica", bandera: "🇨🇷" },
  { codigo: "1809", pais: "República Dominicana", bandera: "🇩🇴" },
  { codigo: "39", pais: "Italia", bandera: "🇮🇹" },
  { codigo: "351", pais: "Portugal", bandera: "🇵🇹" },
] as const

export type ResultadoTelefono =
  | { ok: true; valor: string }
  | { ok: false; mensaje: string }

/** Dígitos del número nacional (sin ceros iniciales ni separadores). */
function digitosNacionales(numero: unknown): string {
  return String(numero ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
}

/**
 * Normaliza `prefijo` + `numero` a E.164 (`+<prefijo><nacional>`).
 * Acepta el número escrito con espacios, guiones o paréntesis.
 */
export function normalizarTelefono(
  prefijo: unknown,
  numero: unknown
): ResultadoTelefono {
  const codigo = String(prefijo ?? "").replace(/\D/g, "") || PREFIJO_POR_DEFECTO
  const nacional = digitosNacionales(numero)

  if (!nacional) {
    return { ok: false, mensaje: "Indica tu número de WhatsApp." }
  }
  if (nacional.length < 7) {
    return {
      ok: false,
      mensaje: "El número de WhatsApp debe tener al menos 7 dígitos.",
    }
  }
  if (nacional.length > 11) {
    return {
      ok: false,
      mensaje: "El número de WhatsApp no puede superar 11 dígitos.",
    }
  }

  const total = `${codigo}${nacional}`
  if (total.length < 8 || total.length > 15) {
    return {
      ok: false,
      mensaje: "Revisa el número: no coincide con el prefijo de país elegido.",
    }
  }

  return { ok: true, valor: `+${total}` }
}

/** ¿El valor almacenado ya es un teléfono E.164 válido (`+` + 8..15 dígitos)? */
export function esTelefonoValido(valor: unknown): boolean {
  return /^\+[1-9]\d{7,14}$/.test(String(valor ?? "").trim())
}
