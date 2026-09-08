/**
 * MEDISYS · Enlace de WhatsApp para confirmar/consultar la cita.
 *
 * `generateWhatsAppShareUrl` construye un enlace https://wa.me/... con un
 * mensaje estructurado en texto plano (URL-encoded) con los datos clave de
 * la reserva: código, paciente, especialista, fecha, turno y pago.
 */
import type { Appointment } from "@/types/database"

/** Etiqueta corta del turno para mensajes/recibos. */
export function turnoLabel(
  turno: Appointment["turno"]
): string {
  if (turno === "manana") return "Mañana"
  if (turno === "tarde") return "Tarde"
  return "Por confirmar"
}

/** 'YYYY-MM-DDTHH:mm...' → "02/09/2026 10:30". */
function fechaLegible(fechaHora: string): string {
  const fecha = fechaHora.slice(0, 10)
  const hora = fechaHora.length >= 16 ? fechaHora.slice(11, 16) : ""
  if (!fecha) return "Por confirmar"
  const [y, m, d] = fecha.split("-").map(Number)
  const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${date.getFullYear()}${hora ? ` ${hora}` : ""}`
}

function metodoPagoLegible(appointment: Appointment): string {
  const metodoCaja = appointment.payment_method
  const enLinea = appointment.estado === "pendiente_validacion"
  const enRecepcion = appointment.estado === "pago_en_recepcion"

  if (metodoCaja === "efectivo") return "Efectivo (en caja)"
  if (metodoCaja === "punto") return "Punto de Venta (en caja)"
  if (metodoCaja === "pago_movil") return "Pago Móvil (en caja)"
  if (enLinea && appointment.referencia_pago) {
    return `Pago Móvil en línea · Referencia ${appointment.referencia_pago}`
  }
  if (enLinea) return "Pago Móvil en línea · Comprobante adjunto"
  if (enRecepcion) return "Pagar en recepción"
  return "Por confirmar"
}

export type WhatsAppShareInput = {
  tenantName: string
  appointment: Appointment
  /** Teléfono de la clínica (WhatsApp). Se normaliza quitando signos. */
  clinicPhone: string | null
  patientName?: string
  doctorName?: string
  especialidad?: string
}

/**
 * Devuelve el enlace wa.me listo para `target="_blank"`, o `null` si la
 * clínica no tiene teléfono de WhatsApp configurado.
 */
export function generateWhatsAppShareUrl({
  tenantName,
  appointment,
  clinicPhone,
  patientName,
  doctorName,
  especialidad,
}: WhatsAppShareInput): string | null {
  const telefono = clinicPhone?.replace(/[^\d]/g, "")
  if (!telefono) return null

  const codigo = appointment.id.slice(0, 8).toUpperCase()
  const lineas = [
    `Hola ${tenantName}, tengo una cita reservada con Medisys 👋`,
    ``,
    `📋 Código: ${codigo}`,
    `🧑 Paciente: ${patientName ?? "—"}`,
    `👨‍⚕️ Especialista: ${doctorName ?? "—"}${
      especialidad ? ` (${especialidad})` : ""
    }`,
    `📅 Fecha: ${fechaLegible(appointment.fecha_hora)}`,
    `🕐 Turno: ${turnoLabel(appointment.turno)}`,
    `💳 Pago: ${metodoPagoLegible(appointment)}`,
    ``,
    `Por favor confírmame los detalles de mi cita.`,
  ]

  return `https://wa.me/${telefono}?text=${encodeURIComponent(lineas.join("\n"))}`
}
