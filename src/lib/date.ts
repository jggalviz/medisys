/**
 * MEDISYS · Utilidades de fecha/hora para el flujo de reserva.
 *
 * Todas las horas de consulta se interpretan en hora local del tenant
 * (America/Caracas, UTC-04:00, sin horario de verano). Evitamos manejo
 * de zonas del servidor para que un cupo "08:00" sea 08:00 en Caracas
 * sin importar dónde corra Next.js.
 */
import { VE_TIMEZONE } from "@/types/database"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** 'YYYY-MM-DD' -> fecha local (evita corrimientos por UTC en el navegador). */
export function parseDateISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number)
  // Mediodía local: inmune a cambios de horario.
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isValidDateISO(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const date = parseDateISO(value)
  return !Number.isNaN(date.getTime()) && toISODate(date) === value
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value)
}

/** Combina fecha + hora local del tenant en ISO 8601 con offset (timestamptz). */
export function combineToISO(dateISO: string, hora: string): string {
  return `${dateISO}T${hora}:00${VE_TIMEZONE}`
}

/** Sólo 'YYYY-MM-DDTHH:mm' (sin segundos ni zona), usado por la UI. */
export function combineToLocal(dateISO: string, hora: string): string {
  return `${dateISO}T${hora}`
}

/** 'HH:mm' -> minutos desde medianoche. */
export function timeToMinutes(hora: string): number {
  const [h, m] = hora.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** minutos desde medianoche -> 'HH:mm'. */
export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Formatea '2026-09-02' como 'mié, 2 sep 2026'. */
export function formatLongDate(dateISO: string): string {
  const date = parseDateISO(dateISO)
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

/** Formatea '2026-09-02' como 'mié, 2 sep'. */
export function formatShortDate(dateISO: string): string {
  const date = parseDateISO(dateISO)
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date)
}

/** Mes completo 'septiembre 2026' (capitaliza). */
export function formatMonthYear(year: number, monthIndex: number): string {
  const label = new Intl.DateTimeFormat("es-VE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1, 12))
  return label.charAt(0).toUpperCase() + label.slice(1)
}
