import type { CuentaCobro, Doctor, Profile } from "@/types/database"

/** "Jane" de "Jane María" -> inicial(es). */
export function iniciales(nombres: string, apellidos: string): string {
  const take = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("")

  const parts = take(`${nombres} ${apellidos}`)
  return parts || "?"
}

/** Nombre legible de un perfil/paciente: "Jane, María R." */
export function perfilNombre(profile: Profile): string {
  return [profile.nombres, profile.apellidos].filter(Boolean).join(" ").trim()
}

/**
 * Nombre legible de un médico, tolerante a `apellidos` nulos/vacíos y con
 * fallback a la columna `nombre` (nombre completo) cuando exista.
 * Ej.: "María Rivas" · "Dra. Laura Rincón".
 */
export function doctorNombre(
  doctor: Pick<Doctor, "nombres" | "apellidos"> & { nombre?: string | null }
): string {
  const separado = [doctor.nombres, doctor.apellidos].filter(Boolean).join(" ").trim()
  if (separado) return separado
  return doctor.nombre?.trim() || "Médico"
}

/** Precio formateado en VES/Bs. p. ej. "Bs.S 25,00". */
export function formatMonto(monto: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: monto % 1 === 0 ? 2 : 2,
    maximumFractionDigits: 2,
  }).format(monto)
}

/** Etiqueta de una cuenta de cobro (banco o Zelle) para el paso de pago. */
export function cuentaTitulo(cuenta: CuentaCobro): string {
  if (cuenta.metodo === "zelle") return "Zelle"
  return cuenta.banco ?? "Pago Móvil"
}

/** Detalle secundario (teléfono o correo) de una cuenta de cobro. */
export function cuentaDetalle(cuenta: CuentaCobro): string | null {
  if (cuenta.metodo === "pago_movil") return cuenta.telefono
  return cuenta.correo_zelle
}
