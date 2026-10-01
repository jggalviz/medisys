/**
 * MEDISYS · Caso de estudio público (`/proceso-saas`)
 * ------------------------------------------------------------------
 * Datos de referencia del caso de estudio: enlaces, stack y las métricas del
 * repositorio que se muestran en la portada.
 *
 * NOTA: todas las cifras son verificables en el código fuente (ver
 * `GITHUB_URL`): se obtuvieron contando archivos, migraciones, políticas RLS,
 * rutas del App Router y módulos `"use server"` de este mismo proyecto.
 */
import { RESERVAR_DEMO_ROUTE } from "@/lib/demo"
import { URL_SITIO_PUBLICO } from "@/lib/site"

/* --------------------------- Enlaces ------------------------------ */

/** Repositorio oficial: fuente de todo lo que se afirma en esta página. */
export const GITHUB_URL = "https://github.com/jggalviz/medisys"

/** Handle público del autor (GitHub). */
export const GITHUB_HANDLE = "@jggalviz"

/** Clínica de demostración (wizard de reserva real, sin registro). */
export const DEMO_ROUTE = RESERVAR_DEMO_ROUTE
export const DEMO_URL = `${URL_SITIO_PUBLICO}${RESERVAR_DEMO_ROUTE}`

/** Contacto profesional. */
export const SALES_EMAIL = "ventas@vortex.com.ve"
export const WHATSAPP_NUMBER = "584228101010"
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola 👋, vi el caso de estudio de Medisys y quiero conversar sobre el proyecto."
)}`

/** Marca / estudio. */
export const COMPANY_NAME = "Vortex Logic Microsystems"
export const COMPANY_URL = "https://vortex.com.ve"
export const SITIO_URL = URL_SITIO_PUBLICO
export const CASO_ESTUDIO_URL = `${URL_SITIO_PUBLICO}/proceso-saas`

/* --------------------------- Navegación --------------------------- */

export const NAV_ANCHORS = [
  { id: "reto", label: "El reto" },
  { id: "arquitectura", label: "Arquitectura" },
  { id: "retos-tecnicos", label: "Retos técnicos" },
  { id: "aprendizajes", label: "Aprendizajes" },
  { id: "contacto", label: "Contacto" },
] as const

/* ------------------------------ Stack ----------------------------- */

export type StackItem = {
  nombre: string
  detalle: string
}

export const STACK: readonly StackItem[] = [
  { nombre: "Next.js 16", detalle: "App Router · RSC · Server Actions" },
  { nombre: "React 19", detalle: "Streaming + composición por rutas" },
  { nombre: "TypeScript 5", detalle: "strict, tipos de BD de extremo a extremo" },
  { nombre: "Supabase", detalle: "Postgres · Auth · Storage · RLS" },
  { nombre: "Tailwind CSS v4", detalle: "tokens en @theme, sin CSS muerto" },
  { nombre: "Vercel", detalle: "Cron diario · middleware de routing" },
]

export type Metrica = {
  valor: string
  label: string
  detalle: string
}

/** Cifras medidas sobre el repositorio (no estimaciones de marketing). */
export const METRICAS: readonly Metrica[] = [
  { valor: "44.3k", label: "líneas TS/TSX", detalle: "212 archivos en src/" },
  { valor: "22", label: "migraciones SQL", detalle: "esquema versionado de 16 tablas" },
  { valor: "64", label: "políticas RLS", detalle: "aislamiento por clínica y por rol" },
  { valor: "49", label: "rutas App Router", detalle: "32 páginas + 17 route handlers" },
  { valor: "20", label: "módulos use server", detalle: "mutaciones sin API REST intermedia" },
  { valor: "5 × 21", label: "roles × permisos", detalle: "RBAC calculado desde una única fuente" },
]
