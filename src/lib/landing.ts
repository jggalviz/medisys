/**
 * MEDISYS · Landing Page del tenant (utilidades puras).
 *
 * Tolerante al esquema: `landing_config` puede llegar como objeto, string JSON,
 * null o con campos parciales. `normalizarLandingConfig` siempre devuelve una
 * estructura completa para que la vista pública y el editor no fallen.
 */
import type {
  LandingBadges,
  LandingConfig,
  LandingFaq,
  LandingServicio,
  Tenant,
} from "@/types/database"

export const LANDING_VACIA: LandingConfig = {
  hero_titulo: null,
  hero_subtitulo: null,
  sobre_nosotros: null,
  horarios: null,
  instagram: null,
  facebook: null,
  subespecialidades: null,
  mpps: null,
  colegio_medico: null,
  universidad: null,
  badges: { emergencias: false, telemedicina: false },
  direccion_detallada: null,
  punto_referencia: null,
  metodos_pago: [],
  servicios: [],
  faq: [],
}

/** Métodos de pago sugeridos en el editor (se pueden elegir varios). */
export const METODOS_PAGO = [
  "Pago Móvil",
  "Transferencia",
  "Zelle",
  "Efectivo",
  "Tarjeta (débito/crédito)",
  "Pago en recepción",
  "Punto de venta",
] as const

/** Límites de longitud para evitar payloads abusivos desde el editor. */
export const LANDING_LIMITES = {
  corto: 160,
  medio: 400,
  largo: 2000,
  servicios: 12,
  faq: 10,
  metodosPago: 8,
} as const

function texto(value: unknown): string | null {
  if (typeof value !== "string") return null
  const limpio = value.trim()
  return limpio ? limpio : null
}

function textoLimitado(value: unknown, max: number): string | null {
  const limpio = texto(value)
  if (!limpio) return null
  return limpio.slice(0, max)
}

function normalizarServicios(value: unknown): LandingServicio[] {
  if (!Array.isArray(value)) return []
  const lista: LandingServicio[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const fila = item as Record<string, unknown>
    const titulo = textoLimitado(fila.titulo, LANDING_LIMITES.corto)
    if (!titulo) continue
    lista.push({
      titulo,
      descripcion: textoLimitado(fila.descripcion, LANDING_LIMITES.medio) ?? "",
    })
    if (lista.length >= LANDING_LIMITES.servicios) break
  }
  return lista
}

/** Normaliza una lista de textos cortos (métodos de pago, etc.). */
function normalizarListaTexto(
  value: unknown,
  maxItems: number,
  maxLen: number
): string[] {
  if (!Array.isArray(value)) return []
  const lista: string[] = []
  for (const item of value) {
    const limpio = textoLimitado(item, maxLen)
    if (!limpio || lista.includes(limpio)) continue
    lista.push(limpio)
    if (lista.length >= maxItems) break
  }
  return lista
}

/** Normaliza los badges de atención (emergencias / telemedicina). */
function normalizarBadges(value: unknown): LandingBadges {
  if (!value || typeof value !== "object") {
    return { emergencias: false, telemedicina: false }
  }
  const fila = value as Record<string, unknown>
  return {
    emergencias: fila.emergencias === true,
    telemedicina: fila.telemedicina === true,
  }
}

/** Normaliza el módulo dinámico de preguntas frecuentes. */
function normalizarFaq(value: unknown): LandingFaq[] {
  if (!Array.isArray(value)) return []
  const lista: LandingFaq[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const fila = item as Record<string, unknown>
    const pregunta = textoLimitado(fila.pregunta, LANDING_LIMITES.medio)
    if (!pregunta) continue
    lista.push({
      pregunta,
      respuesta: textoLimitado(fila.respuesta, LANDING_LIMITES.largo) ?? "",
    })
    if (lista.length >= LANDING_LIMITES.faq) break
  }
  return lista
}

/** Normaliza cualquier forma de `landing_config` a un `LandingConfig` completo. */
export function normalizarLandingConfig(raw: unknown): LandingConfig {
  let datos: unknown = raw

  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos)
    } catch {
      datos = null
    }
  }
  if (!datos || typeof datos !== "object") return { ...LANDING_VACIA }

  const fila = datos as Record<string, unknown>
  return {
    hero_titulo: textoLimitado(fila.hero_titulo, LANDING_LIMITES.corto),
    hero_subtitulo: textoLimitado(fila.hero_subtitulo, LANDING_LIMITES.medio),
    sobre_nosotros: textoLimitado(fila.sobre_nosotros, LANDING_LIMITES.largo),
    horarios: textoLimitado(fila.horarios, LANDING_LIMITES.medio),
    instagram: textoLimitado(fila.instagram, LANDING_LIMITES.corto),
    facebook: textoLimitado(fila.facebook, LANDING_LIMITES.corto),
    subespecialidades: textoLimitado(fila.subespecialidades, LANDING_LIMITES.medio),
    mpps: textoLimitado(fila.mpps, LANDING_LIMITES.corto),
    colegio_medico: textoLimitado(fila.colegio_medico, LANDING_LIMITES.corto),
    universidad: textoLimitado(fila.universidad, LANDING_LIMITES.medio),
    badges: normalizarBadges(fila.badges),
    direccion_detallada: textoLimitado(fila.direccion_detallada, LANDING_LIMITES.medio),
    punto_referencia: textoLimitado(fila.punto_referencia, LANDING_LIMITES.medio),
    metodos_pago: normalizarListaTexto(
      fila.metodos_pago,
      LANDING_LIMITES.metodosPago,
      LANDING_LIMITES.corto
    ),
    servicios: normalizarServicios(fila.servicios),
    faq: normalizarFaq(fila.faq),
  }
}

/** Sanitiza el payload recibido desde el editor antes de persistirlo. */
export function limpiarLandingConfig(raw: unknown): LandingConfig {
  return normalizarLandingConfig(raw)
}

/** ¿La landing pública está habilitada? (default: true). */
export function landingHabilitada(tenant: Pick<Tenant, "landing_enabled">): boolean {
  return tenant.landing_enabled !== false
}

/** Normaliza el handle de red social a una URL completa. */
export function urlRedSocial(
  valor: string | null | undefined,
  red: "instagram" | "facebook"
): string | null {
  const limpio = valor?.trim()
  if (!limpio) return null
  if (/^https?:\/\//i.test(limpio)) return limpio
  const handle = limpio.replace(/^@/, "").replace(/^\/+/, "")
  if (!handle) return null
  return red === "instagram"
    ? `https://instagram.com/${handle}`
    : `https://facebook.com/${handle}`
}
