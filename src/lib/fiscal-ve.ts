/**
 * MEDISYS · Reglas fiscales de Venezuela (SENIAT)
 * ----------------------------------------------------------
 * Módulo sin dependencias (seguro para componentes cliente y servidor) con las
 * validaciones y cálculos que exige el mercado venezolano:
 *   - RIF: `V|E|J|G` + 8 dígitos + dígito verificador → `V-12345678-9`.
 *   - Cédula de identidad: `V|E` + 6 a 9 dígitos.
 *   - Pasaporte: alfanumérico.
 *   - IVA general (16%) e IVA exento para servicios médicos directos
 *     (Art. 17, numeral 4 de la Ley de IVA).
 *   - Reparto del honorario médico (porcentaje o monto fijo en USD).
 *
 * Las funciones de normalización devuelven `null` cuando el valor de entrada no
 * es válido, de modo que quien las consume decide el mensaje de error.
 */
import type {
  DoctorCommissionType,
  TipoDocumentoFiscal,
} from "@/types/database"

/** Tipos de documento fiscal aceptados (persona natural o jurídica). */
export const TIPOS_DOCUMENTO: readonly TipoDocumentoFiscal[] = [
  "V",
  "E",
  "J",
  "G",
  "P",
]

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoFiscal, string> = {
  V: "V · Venezolano (cédula)",
  E: "E · Extranjero (cédula)",
  J: "J · Jurídico (RIF)",
  G: "G · Gubernamental (RIF)",
  P: "P · Pasaporte",
}

/** Formas de reparto del honorario médico. */
export const TIPOS_COMISION: readonly DoctorCommissionType[] = [
  "PERCENTAGE",
  "FIXED",
]

export const TIPO_COMISION_LABEL: Record<DoctorCommissionType, string> = {
  PERCENTAGE: "Porcentaje del servicio",
  FIXED: "Monto fijo en USD",
}

/** Alícuota general de IVA vigente en Venezuela (16%). */
export const IVA_VENEZUELA = 0.16

/** RIF canónico: `V-12345678-9`. */
export const RIF_REGEX = /^([VEJG])-(\d{8})-(\d)$/

/** Cédula canónica: `V-12345678`. */
export const CEDULA_REGEX = /^([VE])-(\d{6,9})$/

/** Pasaporte: alfanumérico de 5 a 15 caracteres. */
export const PASAPORTE_REGEX = /^[A-Z0-9]{5,15}$/

/** Email simple (mismo criterio permisivo que el resto de la app). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Teléfono venezolano: 7 a 11 dígitos (fijo `0212…`, móvil `0414…` o `+58…`). */
export const TELEFONO_VE_REGEX = /^(?:\+?58)?\d{7,11}$/

/** UUID v4 (identificadores de Supabase). */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Fecha ISO `YYYY-MM-DD`. */
export const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_REGEX.test(valor.trim())
}

/** Normaliza un RIF al formato canónico `V-12345678-9` (o `null` si es inválido). */
export function normalizarRif(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null
  const limpio = String(valor)
    .toUpperCase()
    .replace(/[\s.]/g, "")
  const coincidencia = limpio.match(/^([VEJG])-?(\d{8})-?(\d)$/)
  if (!coincidencia) return null
  return `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}`
}

export function esRifValido(valor: unknown): boolean {
  return normalizarRif(valor) !== null
}

/** Normaliza una cédula al formato `V-12345678` (o `null` si es inválida). */
export function normalizarCedula(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null
  const limpio = String(valor)
    .toUpperCase()
    .replace(/[\s.]/g, "")
  const coincidencia = limpio.match(/^([VE])-?(\d{6,9})$/)
  if (!coincidencia) return null
  return `${coincidencia[1]}-${coincidencia[2]}`
}

/**
 * Normaliza el documento de identidad según su tipo:
 *  - V/E → cédula (`V-12345678`).
 *  - J/G → RIF (`J-12345678-9`).
 *  - P   → pasaporte en mayúsculas sin espacios.
 * Devuelve `null` si no cumple el formato del tipo indicado.
 */
export function normalizarDocumentoIdentidad(
  valor: unknown,
  tipo: TipoDocumentoFiscal
): string | null {
  if (tipo === "P") {
    if (typeof valor !== "string" && typeof valor !== "number") return null
    const limpio = String(valor)
      .toUpperCase()
      .replace(/[\s-]/g, "")
    return PASAPORTE_REGEX.test(limpio) ? limpio : null
  }
  return tipo === "J" || tipo === "G"
    ? normalizarRif(valor)
    : normalizarCedula(valor)
}

/** Documento listo para mostrar: `V-12.345.678` · `J-12.345.678-9`. */
export function formatearDocumentoIdentidad(
  tipo: TipoDocumentoFiscal,
  documento: string
): string {
  const limpio = documento.replace(/[\s.]/g, "").toUpperCase()
  if (tipo === "P") return limpio
  if (tipo === "J" || tipo === "G") {
    const normalizado = normalizarRif(limpio)
    if (!normalizado) return limpio
    const [, cuerpo, verificador] = normalizado.match(RIF_REGEX) ?? []
    const numero = Number(cuerpo)
    return `${tipo}-${Number.isFinite(numero) ? numero.toLocaleString("es-VE") : cuerpo}-${verificador}`
  }
  const normalizado = normalizarCedula(limpio)
  if (!normalizado) return limpio
  const [, cuerpo] = normalizado.match(CEDULA_REGEX) ?? []
  const numero = Number(cuerpo)
  return `${tipo}-${Number.isFinite(numero) ? numero.toLocaleString("es-VE") : cuerpo}`
}

/* ------------------------------------------------------------------ */
/* Cálculos monetarios                                                */
/* ------------------------------------------------------------------ */

/** Redondeo a 2 decimales (evita errores de coma flotante en totales). */
export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/** Alícuota aplicable: 16% si el servicio es gravado, 0% si es exento. */
export function alicuotaIva(taxable: boolean): number {
  return taxable ? IVA_VENEZUELA : 0
}

/** Desglose fiscal de un servicio: subtotal (USD), IVA (USD) y total (USD). */
export function calcularTotalServicio(
  priceUSD: number,
  taxable: boolean
): { subtotal: number; iva: number; total: number; alicuota: number } {
  const subtotal = redondear2(Math.max(0, priceUSD))
  const alicuota = alicuotaIva(taxable)
  const iva = redondear2(subtotal * alicuota)
  return { subtotal, iva, total: redondear2(subtotal + iva), alicuota }
}

/**
 * Honorario del especialista para un servicio:
 *  - `PERCENTAGE`: porcentaje (0-100) del precio del servicio.
 *  - `FIXED`: monto fijo en USD (nunca superior al precio del servicio).
 */
export function calcularHonorarioMedico(
  priceUSD: number,
  tipo: DoctorCommissionType,
  valor: number
): number {
  const precio = Math.max(0, priceUSD)
  const base = Math.max(0, valor)
  if (tipo === "FIXED") return redondear2(Math.min(base, precio))
  const porcentaje = Math.min(base, 100)
  return redondear2((precio * porcentaje) / 100)
}

