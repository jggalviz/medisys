/**
 * MEDISYS · Validación del registro público de consultorios (`/registro`).
 * ---------------------------------------------------------------
 * Módulo PURO (servidor + cliente) construido sobre
 * `src/lib/validations/core.ts` (la misma ergonomía Zod-compatible del resto de
 * módulos), para que:
 *   - el formulario muestre errores en tiempo real campo por campo
 *     (`validarCampoRegistro`), y
 *   - la Server Action revalide el payload completo antes de crear nada
 *     (`registroPublicoSchema`), sin confiar en el cliente.
 *
 * La contraseña NUNCA se almacena aquí: se entrega a Supabase Auth, que aplica
 * bcrypt antes de guardarla en `auth.users`.
 */
import type { CampoIssue } from "@/types/admin"
import type { PlanTenant } from "@/types/database"
import { ESPECIALIDAD_OTRA, etiquetaEspecialidad } from "@/lib/especialidades"
import { slugificar } from "@/lib/slug"
import { esPlanTenant, PLANES_TENANT } from "@/lib/suscripcion"
import { normalizarTelefono, PREFIJO_POR_DEFECTO } from "@/lib/telefono"
import { PLAN_REGISTRO_POR_DEFECTO } from "@/lib/trial"
import {
  comoObjeto,
  comoTexto,
  crearEsquema,
  enumerado,
  error,
  textoRequerido,
  type Contexto,
  type ResultadoValidacion,
} from "./core"

/** Longitud mínima de la contraseña (y máxima admitida por bcrypt). */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

/** Longitud máxima del slug público del consultorio. */
export const SLUG_CONSULTORIO_MAX = 48

/** Campos del formulario de registro (claves de los mensajes de error). */
export const CAMPOS_REGISTRO = [
  "plan",
  "nombre",
  "email",
  "telefono",
  "consultorio",
  "especialidad",
  "password",
  "confirmarPassword",
] as const

export type RegistroCampo = (typeof CAMPOS_REGISTRO)[number]

/** Payload tal como lo envía el formulario. */
export type RegistroInput = {
  /** Plan comercial elegido en el selector de tarjetas del registro. */
  plan?: PlanTenant | string
  /** Nombre y apellido del responsable de la cuenta. */
  nombre: string
  email: string
  /** Prefijo de país sin `+` (por defecto '58' = Venezuela). */
  prefijo?: string
  /** Número nacional tal como lo escribió el usuario (0412…, 412-1234…). */
  telefono: string
  /** Nombre del consultorio o clínica (origen del slug público). */
  consultorio: string
  /** Valor del catálogo, `otra` o texto libre. */
  especialidad?: string
  /** Especialidad escrita a mano cuando `especialidad === 'otra'`. */
  especialidadOtra?: string
  password: string
  confirmarPassword: string
}

/** Datos ya normalizados que consume la Server Action. */
export type RegistroDatos = {
  /** Plan comercial validado (columna `tenants.plan_type`). */
  plan: PlanTenant
  nombre: string
  email: string
  /** E.164 sin separadores (ej. '+584121234567'). */
  telefono: string
  consultorio: string
  /** Slug base del consultorio (el servidor lo vuelve único). */
  slug: string
  especialidad: string
  password: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Correo electrónico plausible (validación de forma, no de existencia). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/** Slug público del consultorio a partir de su nombre. */
export function slugDesdeConsultorio(nombre: unknown): string {
  return slugificar(comoTexto(nombre))
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_CONSULTORIO_MAX)
    .replace(/-+$/g, "")
}

/** Correo normalizado (minúsculas + trim), como exige el login del panel. */
export function normalizarEmail(valor: unknown): string {
  return comoTexto(valor).trim().toLowerCase()
}

/** Divide 'Ana María Pérez' en nombres/apellidos para la ficha del médico. */
export function partesNombre(nombre: string): {
  nombres: string
  apellidos: string
} {
  const partes = comoTexto(nombre).trim().split(/\s+/).filter(Boolean)
  return {
    nombres: partes[0] ?? "",
    apellidos: partes.slice(1).join(" "),
  }
}

/** Especialidad final a partir del selector (catálogo / 'otra' / texto libre). */
export function especialidadFinal(input: {
  especialidad?: string
  especialidadOtra?: string
}): string {
  const valor = comoTexto(input.especialidad).trim()
  if (!valor || valor === ESPECIALIDAD_OTRA) {
    return comoTexto(input.especialidadOtra).trim()
  }
  if (valor.length > 3 && !/^[a-z0-9-]+$/.test(valor)) return valor
  return etiquetaEspecialidad(valor)
}

/**
 * Plan comercial recibido del formulario: acepta `'INDIVIDUAL' | 'PYME' | 'PRO'`
 * (sin distinguir mayúsculas) y cae en `PLAN_REGISTRO_POR_DEFECTO` cuando el
 * campo llega vacío (formularios antiguos), devolviendo `null` solo si el valor
 * es explícitamente inválido.
 */
export function planFinal(valor: unknown): PlanTenant | null {
  const limpio = comoTexto(valor).trim()
  if (!limpio) return PLAN_REGISTRO_POR_DEFECTO
  return esPlanTenant(limpio)
    ? (limpio.toUpperCase() as PlanTenant)
    : null
}

/* ------------------------------------------------------------------ */
/* Validación por campo (tiempo real en el formulario)                */
/* ------------------------------------------------------------------ */

/**
 * Valida un campo de forma aislada. Devuelve `null` si es válido o el mensaje
 * de error a mostrar. `contexto.password` y `contexto.prefijo` permiten validar
 * la confirmación de contraseña y el teléfono mientras se escribe.
 */
export function validarCampoRegistro(
  campo: RegistroCampo,
  valor: unknown,
  contexto: {
    password?: string
    prefijo?: string
    especialidadOtra?: string
  } = {}
): string | null {
  switch (campo) {
    case "plan": {
      if (!planFinal(valor)) {
        return `Elige uno de los planes disponibles: ${PLANES_TENANT.join(", ")}.`
      }
      return null
    }
    case "nombre": {
      const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
      if (limpio.length < 3) return "Escribe tu nombre y apellido."
      if (limpio.length > 120) {
        return "El nombre no puede superar 120 caracteres."
      }
      if (limpio.split(/\s+/).filter(Boolean).length < 2) {
        return "Indica al menos un nombre y un apellido."
      }
      return null
    }
    case "email": {
      const limpio = normalizarEmail(valor)
      if (!limpio) return "El correo electrónico es obligatorio."
      if (!EMAIL_RE.test(limpio)) return "El correo no tiene un formato válido."
      if (limpio.length > 160) return "El correo es demasiado largo."
      return null
    }
    case "telefono": {
      const resultado = normalizarTelefono(
        contexto.prefijo ?? PREFIJO_POR_DEFECTO,
        valor
      )
      return resultado.ok ? null : resultado.mensaje
    }
    case "consultorio": {
      const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
      if (limpio.length < 3) {
        return "Indica el nombre del consultorio o clínica."
      }
      if (limpio.length > 80) {
        return "El nombre del consultorio no puede superar 80 caracteres."
      }
      if (slugDesdeConsultorio(limpio).length < 3) {
        return "El nombre debe incluir letras o números para generar el enlace."
      }
      return null
    }
    case "especialidad": {
      const final = especialidadFinal({
        especialidad: comoTexto(valor),
        especialidadOtra: contexto.especialidadOtra,
      })
      if (!final) return "Selecciona o escribe tu especialidad médica."
      if (final.length < 3) return "La especialidad es demasiado corta."
      if (final.length > 80) {
        return "La especialidad no puede superar 80 caracteres."
      }
      return null
    }
    case "password": {
      const limpio = comoTexto(valor)
      if (limpio.length < PASSWORD_MIN) {
        return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
      }
      if (limpio.length > PASSWORD_MAX) {
        return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`
      }
      return null
    }
    case "confirmarPassword": {
      const limpio = comoTexto(valor)
      if (!limpio) return "Repite la contraseña."
      if (limpio !== comoTexto(contexto.password)) {
        return "Las contraseñas no coinciden."
      }
      return null
    }
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/* Esquema completo (validación autoritativa en el servidor)          */
/* ------------------------------------------------------------------ */

function validarRegistroCompleto(
  entrada: unknown
): ResultadoValidacion<RegistroDatos> {
  const raw = comoObjeto(entrada)
  const ctx: Contexto = { issues: [] }

  const input: RegistroInput = {
    plan: comoTexto(raw.plan) || PLAN_REGISTRO_POR_DEFECTO,
    nombre: comoTexto(raw.nombre),
    email: comoTexto(raw.email),
    prefijo: comoTexto(raw.prefijo) || PREFIJO_POR_DEFECTO,
    telefono: comoTexto(raw.telefono),
    consultorio: comoTexto(raw.consultorio),
    especialidad: comoTexto(raw.especialidad),
    especialidadOtra: comoTexto(raw.especialidadOtra),
    password: comoTexto(raw.password),
    confirmarPassword: comoTexto(raw.confirmarPassword),
  }

  // Plan comercial (obligatorio: define cupo y facturación de la cuenta).
  const plan = enumerado(
    ctx,
    "plan",
    "El plan",
    input.plan,
    PLANES_TENANT,
    null
  )

  const nombre = textoRequerido(
    ctx,
    "nombre",
    "El nombre y apellido",
    input.nombre,
    { min: 3, max: 120 }
  )
  // Misma regla que la validación en vivo del formulario: nombre + apellido.
  if (nombre && nombre.split(/\s+/).filter(Boolean).length < 2) {
    ctx.issues.push({
      campo: "nombre",
      mensaje: "Indica al menos un nombre y un apellido.",
    })
  }

  const email = normalizarEmail(input.email)
  if (!email) {
    ctx.issues.push({
      campo: "email",
      mensaje: "El correo electrónico es obligatorio.",
    })
  } else if (!EMAIL_RE.test(email)) {
    ctx.issues.push({
      campo: "email",
      mensaje: "El correo no tiene un formato válido.",
    })
  }

  const telefono = normalizarTelefono(input.prefijo, input.telefono)
  if (!telefono.ok) {
    ctx.issues.push({ campo: "telefono", mensaje: telefono.mensaje })
  }

  const consultorio = textoRequerido(
    ctx,
    "consultorio",
    "El nombre del consultorio",
    input.consultorio,
    { min: 3, max: 80 }
  )
  const slug = slugDesdeConsultorio(consultorio)
  if (consultorio.length >= 3 && slug.length < 3) {
    ctx.issues.push({
      campo: "consultorio",
      mensaje: "El nombre debe incluir letras o números para generar el enlace.",
    })
  }

  const especialidad = especialidadFinal(input)
  if (!especialidad) {
    ctx.issues.push({
      campo: "especialidad",
      mensaje: "Selecciona o escribe tu especialidad médica.",
    })
  } else if (especialidad.length > 80) {
    ctx.issues.push({
      campo: "especialidad",
      mensaje: "La especialidad no puede superar 80 caracteres.",
    })
  }

  const password = input.password
  if (password.length < PASSWORD_MIN) {
    ctx.issues.push({
      campo: "password",
      mensaje: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
    })
  } else if (password.length > PASSWORD_MAX) {
    ctx.issues.push({
      campo: "password",
      mensaje: `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`,
    })
  }
  if (input.confirmarPassword !== password) {
    ctx.issues.push({
      campo: "confirmarPassword",
      mensaje: "Las contraseñas no coinciden.",
    })
  }

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }

  return {
    success: true,
    data: {
      plan,
      nombre,
      email,
      telefono: telefono.ok ? telefono.valor : "",
      consultorio,
      slug,
      especialidad: especialidad || etiquetaEspecialidad(null),
      password,
    },
  }
}

/** Esquema del registro público (`safeParse` / `parse`). */
export const registroPublicoSchema = crearEsquema(validarRegistroCompleto)

/** Validador directo, útil cuando no se necesita el envoltorio del esquema. */
export const validarRegistro = validarRegistroCompleto

/** Convierte las incidencias en un mapa `campo → mensaje` para la UI. */
export function erroresPorCampo(
  issues: CampoIssue[]
): Partial<Record<RegistroCampo, string>> {
  const mapa: Partial<Record<RegistroCampo, string>> = {}
  for (const issue of issues) {
    const campo = issue.campo as RegistroCampo
    if (!mapa[campo]) mapa[campo] = issue.mensaje
  }
  return mapa
}
