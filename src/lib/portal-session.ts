/**
 * MEDISYS · Sesión ligera de portales (Especialista / Paciente).
 *
 * Cookie `portal_session` httpOnly y firmada con HMAC-SHA256. El payload es
 * legible pero no modificable sin `PORTAL_SESSION_SECRET`.
 */
import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "crypto"

export type PortalRol = "especialista" | "paciente"

export type PortalSession = {
  id: string
  rol: PortalRol
  tenant_id: string
  nombre: string
  cedula: string
}

export const PORTAL_COOKIE = "portal_session"

const SEGUNDOS_DIA = 24 * 60 * 60
const MAX_AGE = 30 * SEGUNDOS_DIA

function secreto(): string {
  // En producción definir PORTAL_SESSION_SECRET. Fallback solo desarrollo.
  return process.env.PORTAL_SESSION_SECRET ?? "medisys-portal-dev-secret"
}

function toBase64Url(texto: string): string {
  return Buffer.from(texto, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(texto: string): string {
  return Buffer.from(
    texto.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8")
}

function firmar(payload: string): string {
  return createHmac("sha256", secreto()).update(payload).digest("base64url")
}

export function firmarSesion(sesion: PortalSession): string {
  const payload = toBase64Url(JSON.stringify(sesion))
  return `${payload}.${firmar(payload)}`
}

export function verificarSesion(valor: string): PortalSession | null {
  const partes = valor.split(".")
  if (partes.length !== 2) return null
  const [payload, firma] = partes as [string, string]
  try {
    const esperada = firmar(payload)
    const actual = Buffer.from(firma)
    const expectedBuf = Buffer.from(esperada)
    if (actual.length !== expectedBuf.length) return null
    if (!timingSafeEqual(actual, expectedBuf)) return null
    const sesion = JSON.parse(fromBase64Url(payload)) as PortalSession
    if (
      !sesion ||
      typeof sesion.id !== "string" ||
      (sesion.rol !== "especialista" && sesion.rol !== "paciente") ||
      typeof sesion.tenant_id !== "string" ||
      typeof sesion.nombre !== "string"
    ) {
      return null
    }
    return sesion
  } catch {
    return null
  }
}

export async function setPortalCookie(sesion: PortalSession): Promise<void> {
  const store = await cookies()
  store.set(PORTAL_COOKIE, firmarSesion(sesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  })
}

export async function clearPortalCookie(): Promise<void> {
  const store = await cookies()
  store.set(PORTAL_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

/** Lee y valida la cookie de sesión activa (server only). */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies()
  const valor = store.get(PORTAL_COOKIE)?.value
  if (!valor) return null
  return verificarSesion(valor)
}
