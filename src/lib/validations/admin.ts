/**
 * MEDISYS · Esquemas de validación del módulo de administración
 * ----------------------------------------------------------------
 * Validación de entrada (payloads de API y formularios) para:
 *   1. Entidad fiscal del tenant (facturación SENIAT).
 *   2. Tasa oficial BCV / multimoneda (`CurrencyRate`).
 *   3. Catálogo de servicios médicos y honorarios.
 *   4. Sedes (multi-sede) y usuarios/roles (RBAC).
 *   5. Directorio fiscal de pacientes (`Patient` / `FiscalProfile`).
 *
 * DISEÑO: el proyecto usa Supabase + Postgres como fuente de verdad del
 * esquema (ver `supabase/migrations/0016_admin_module.sql`). Este módulo
 * concentra las reglas de entrada con una API compatible con Zod
 * (`safeParse` / `parse` / `issues`), sin agregar dependencias: si más adelante
 * se adopta Zod, los consumidores (`/api/admin/*` y componentes) no cambian.
 */
import type { CampoIssue } from "@/types/admin"
import type {
  CurrencyCode,
  DoctorCommissionType,
  TenantUserRole,
  TipoDocumentoFiscal,
} from "@/types/database"
import { ROLES_SOPORTADOS } from "@/lib/rbac"
import {
  EMAIL_REGEX,
  FECHA_ISO_REGEX,
  TELEFONO_VE_REGEX,
  TIPOS_COMISION,
  TIPOS_DOCUMENTO,
  esUuid,
  normalizarDocumentoIdentidad,
  normalizarRif,
} from "@/lib/fiscal-ve"
import { fechaHoyVenezuela, isValidDateISO } from "@/lib/date"

/* ------------------------------------------------------------------ */
/* Contrato del validador (compatible con Zod)                         */
/* ------------------------------------------------------------------ */

export type ErrorValidacion = { message: string; issues: CampoIssue[] }

export type ResultadoValidacion<T> =
  | { success: true; data: T }
  | { success: false; error: ErrorValidacion }

export type Validador<T> = (entrada: unknown) => ResultadoValidacion<T>

/** Error lanzado por `parse()` cuando la entrada no es válida. */
export class ErrorValidacionFormulario extends Error {
  readonly issues: CampoIssue[]

  constructor(error: ErrorValidacion) {
    super(error.message)
    this.name = "ErrorValidacionFormulario"
    this.issues = error.issues
  }
}

/** Esquema tipado: envuelve un validador puro con la API de Zod. */
export class Esquema<T> {
  private readonly validador: Validador<T>

  constructor(validador: Validador<T>) {
    this.validador = validador
  }

  safeParse(entrada: unknown): ResultadoValidacion<T> {
    return this.validador(entrada)
  }

  /** Igual que `safeParse` pero lanza `ErrorValidacionFormulario`. */
  parse(entrada: unknown): T {
    const resultado = this.validador(entrada)
    if (!resultado.success) throw new ErrorValidacionFormulario(resultado.error)
    return resultado.data
  }
}

export function crearEsquema<T>(validador: Validador<T>): Esquema<T> {
  return new Esquema(validador)
}

/* ------------------------------------------------------------------ */
/* Utilidades internas de validación                                    */
/* ------------------------------------------------------------------ */

type Contexto = { issues: CampoIssue[] }

function error(ctx: Contexto): ErrorValidacion {
  return {
    message: ctx.issues[0]?.mensaje ?? "Datos inválidos.",
    issues: ctx.issues,
  }
}

function comoObjeto(entrada: unknown): Record<string, unknown> {
  return entrada && typeof entrada === "object" && !Array.isArray(entrada)
    ? (entrada as Record<string, unknown>)
    : {}
}

function comoTexto(valor: unknown): string {
  if (typeof valor === "string") return valor
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor)
  return ""
}

/** Texto obligatorio: recorta, colapsa espacios y valida longitud. */
function textoRequerido(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { min?: number; max?: number } = {}
): string {
  const { min = 1, max = 200 } = limites
  const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
  if (limpio.length < min) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} es obligatorio (mínimo ${min} caracteres).`,
    })
  } else if (limpio.length > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} no puede superar ${max} caracteres.`,
    })
  }
  return limpio
}

/** Texto opcional: vacío/null → `null`. */
function textoOpcional(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { max?: number } = {}
): string | null {
  const { max = 200 } = limites
  const limpio = comoTexto(valor).trim().replace(/\s+/g, " ")
  if (!limpio) return null
  if (limpio.length > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} no puede superar ${max} caracteres.`,
    })
  }
  return limpio
}

/** Número decimal obligatorio (acepta "36,50" y "36.50"). */
function decimalRequerido(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  limites: { min?: number; max?: number; decimales?: number } = {}
): number {
  const { min = 0, max = 1_000_000, decimales = 2 } = limites
  const numero = Number(comoTexto(valor).replace(",", ".").trim())
  if (!Number.isFinite(numero)) {
    ctx.issues.push({ campo, mensaje: `${etiqueta} debe ser un número válido.` })
    return 0
  }
  if (numero < min || numero > max) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe estar entre ${min} y ${max}.`,
    })
    return min
  }
  const factor = 10 ** decimales
  return Math.round(numero * factor) / factor
}

function booleano(valor: unknown, porDefecto: boolean): boolean {
  if (typeof valor === "boolean") return valor
  if (valor === "true" || valor === 1 || valor === "1") return true
  if (valor === "false" || valor === 0 || valor === "0") return false
  return porDefecto
}

function enumerado<T extends string>(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown,
  permitidos: readonly T[],
  porDefecto: T | null
): T {
  const limpio = comoTexto(valor).trim().toUpperCase()
  const encontrado = permitidos.find((item) => item === limpio)
  if (encontrado) return encontrado
  if (porDefecto !== null) return porDefecto
  ctx.issues.push({
    campo,
    mensaje: `${etiqueta} debe ser uno de: ${permitidos.join(", ")}.`,
  })
  return permitidos[0]
}

/** Fecha 'YYYY-MM-DD' obligatoria (usa hoy en Venezuela si viene vacía). */
function fechaRequerida(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown
): string {
  const limpio = comoTexto(valor).trim()
  if (!limpio) return fechaHoyVenezuela()
  if (!FECHA_ISO_REGEX.test(limpio) || !isValidDateISO(limpio)) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe ser una fecha válida (YYYY-MM-DD).`,
    })
  }
  return limpio
}

/* ------------------------------------------------------------------ */
/* 1. Entidad fiscal del tenant                                        */
/* ------------------------------------------------------------------ */

export type EntidadFiscalInput = {
  razonSocial: string
  rif: string
  domicilioFiscal: string
  telefonoContacto: string
  emailFiscal: string
  imprentaAutorizada: string | null
  providenciaFormasLibres: string | null
}

export const entidadFiscalSchema = crearEsquema<EntidadFiscalInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const razonSocial = textoRequerido(
    ctx,
    "razonSocial",
    "La razón social",
    datos.razonSocial,
    { min: 3, max: 160 }
  )

  const rifCrudo = comoTexto(datos.rif).trim()
  const rif = normalizarRif(rifCrudo)
  if (!rif) {
    ctx.issues.push({
      campo: "rif",
      mensaje:
        "El RIF debe tener el formato V-00000000-0 (letra V, E, J o G + 8 dígitos + dígito verificador).",
    })
  }

  const domicilioFiscal = textoRequerido(
    ctx,
    "domicilioFiscal",
    "El domicilio fiscal",
    datos.domicilioFiscal,
    { min: 5, max: 300 }
  )

  const telefonoCrudo = comoTexto(datos.telefonoContacto).trim()
  const telefonoDigitos = telefonoCrudo.replace(/[\s().-]/g, "")
  if (!TELEFONO_VE_REGEX.test(telefonoDigitos)) {
    ctx.issues.push({
      campo: "telefonoContacto",
      mensaje:
        "El teléfono de contacto debe ser un número venezolano válido (ej. 0414-1234567).",
    })
  }

  const emailFiscal = comoTexto(datos.emailFiscal).trim().toLowerCase()
  if (!EMAIL_REGEX.test(emailFiscal)) {
    ctx.issues.push({
      campo: "emailFiscal",
      mensaje: "El correo fiscal no tiene un formato válido (ej. facturacion@clinica.com.ve).",
    })
  }

  const imprentaAutorizada = textoOpcional(
    ctx,
    "imprentaAutorizada",
    "La imprenta autorizada",
    datos.imprentaAutorizada,
    { max: 160 }
  )

  const providenciaFormasLibres = textoOpcional(
    ctx,
    "providenciaFormasLibres",
    "El número de providencia",
    datos.providenciaFormasLibres,
    { max: 60 }
  )

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }

  return {
    success: true,
    data: {
      razonSocial,
      rif: rif ?? rifCrudo.toUpperCase(),
      domicilioFiscal,
      telefonoContacto: telefonoDigitos,
      emailFiscal,
      imprentaAutorizada,
      providenciaFormasLibres,
    },
  }
})

/* ------------------------------------------------------------------ */
/* 2. Tasa oficial BCV / multimoneda (`CurrencyRate`)                  */
/* ------------------------------------------------------------------ */

export type TasaBcvInput = {
  currency: CurrencyCode
  rate: number
  effectiveDate: string
  source: string
  autoUpdate: boolean
}

export const tasaBcvSchema = crearEsquema<TasaBcvInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const currency = enumerado<CurrencyCode>(
    ctx,
    "currency",
    "La moneda",
    datos.currency,
    ["USD", "VES"],
    "USD"
  )

  const rate = decimalRequerido(ctx, "rate", "La tasa", datos.rate, {
    min: 0.0001,
    max: 1_000_000,
    decimales: 4,
  })

  const effectiveDate = fechaRequerida(
    ctx,
    "effectiveDate",
    "La fecha de vigencia",
    datos.effectiveDate
  )

  const source =
    textoOpcional(ctx, "source", "La fuente", datos.source, { max: 60 }) ??
    "MANUAL"

  const autoUpdate = booleano(datos.autoUpdate, false)

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
  return { success: true, data: { currency, rate, effectiveDate, source, autoUpdate } }
})

/* ------------------------------------------------------------------ */
/* 3. Catálogo de servicios médicos y honorarios                       */
/* ------------------------------------------------------------------ */

export type ServicioMedicoInput = {
  title: string
  code: string
  priceUSD: number
  taxable: boolean
  doctorCommissionType: DoctorCommissionType
  doctorCommissionValue: number
  doctorId: string | null
  activo: boolean
}

/** Código interno: letras, números, punto, guion y guion bajo. */
const CODIGO_SERVICIO_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/

export const servicioMedicoSchema = crearEsquema<ServicioMedicoInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const title = textoRequerido(
      ctx,
      "title",
      "El nombre del servicio",
      datos.title,
      { min: 3, max: 160 }
    )

    const codeCrudo = textoRequerido(
      ctx,
      "code",
      "El código del servicio",
      datos.code,
      { min: 2, max: 40 }
    )
    const code = codeCrudo
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9._-]/g, "")
    if (!CODIGO_SERVICIO_REGEX.test(code)) {
      ctx.issues.push({
        campo: "code",
        mensaje:
          "El código solo admite letras, números, punto, guion y guion bajo (ej. CAR-001).",
      })
    }

    const priceUSD = decimalRequerido(
      ctx,
      "priceUSD",
      "El precio en USD",
      datos.priceUSD,
      { min: 0, max: 1_000_000 }
    )

    const taxable = booleano(datos.taxable, false)

    const doctorCommissionType = enumerado<DoctorCommissionType>(
      ctx,
      "doctorCommissionType",
      "El tipo de comisión",
      datos.doctorCommissionType,
      TIPOS_COMISION,
      "PERCENTAGE"
    )

    const doctorCommissionValue = decimalRequerido(
      ctx,
      "doctorCommissionValue",
      "El valor de la comisión",
      datos.doctorCommissionValue ?? 0,
      { min: 0, max: 1_000_000 }
    )

    if (doctorCommissionType === "PERCENTAGE" && doctorCommissionValue > 100) {
      ctx.issues.push({
        campo: "doctorCommissionValue",
        mensaje: "La comisión por porcentaje no puede superar el 100%.",
      })
    }

    const doctorIdCrudo = textoOpcional(
      ctx,
      "doctorId",
      "El especialista",
      datos.doctorId,
      { max: 60 }
    )
    if (doctorIdCrudo && !esUuid(doctorIdCrudo)) {
      ctx.issues.push({
        campo: "doctorId",
        mensaje: "El especialista debe ser un identificador válido.",
      })
    }

    const activo = booleano(datos.activo, true)

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }

    return {
      success: true,
      data: {
        title,
        code,
        priceUSD,
        taxable,
        doctorCommissionType,
        doctorCommissionValue,
        doctorId: doctorIdCrudo,
        activo,
      },
    }
  }
)

/* ------------------------------------------------------------------ */
/* 4. Sedes (multi-sede) y asignación de usuarios (RBAC)               */
/* ------------------------------------------------------------------ */

export type SedeInput = {
  nombre: string
  direccion: string | null
  telefono: string | null
  esPrincipal: boolean
  activo: boolean
}

export const sedeSchema = crearEsquema<SedeInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const nombre = textoRequerido(ctx, "nombre", "El nombre de la sede", datos.nombre, {
    min: 2,
    max: 80,
  })

  const direccion = textoOpcional(ctx, "direccion", "La dirección", datos.direccion, {
    max: 300,
  })

  const telefonoCrudo = textoOpcional(
    ctx,
    "telefono",
    "El teléfono",
    datos.telefono,
    { max: 30 }
  )
  const telefono = telefonoCrudo?.replace(/[\s().-]/g, "") ?? null
  if (telefono && !TELEFONO_VE_REGEX.test(telefono)) {
    ctx.issues.push({
      campo: "telefono",
      mensaje: "El teléfono de la sede debe ser un número venezolano válido.",
    })
  }

  const esPrincipal = booleano(datos.esPrincipal, false)
  const activo = booleano(datos.activo, true)

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
  return { success: true, data: { nombre, direccion, telefono, esPrincipal, activo } }
})

/** Sedes asignables a un usuario (arreglo vacío = acceso a todas las sedes). */
export type AsignacionSedeInput = {
  role: TenantUserRole
  sedeIds: string[]
}

export const asignacionUsuarioSchema = crearEsquema<AsignacionSedeInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const role = enumerado<TenantUserRole>(
      ctx,
      "role",
      "El rol",
      datos.role,
      ROLES_SOPORTADOS,
      null
    )

    const bruto = Array.isArray(datos.sedeIds) ? datos.sedeIds : []
    const sedeIds: string[] = []
    for (const item of bruto) {
      const id = comoTexto(item).trim()
      if (!id) continue
      if (!esUuid(id)) {
        ctx.issues.push({
          campo: "sedeIds",
          mensaje: "Cada sede asignada debe ser un identificador válido.",
        })
        break
      }
      if (!sedeIds.includes(id)) sedeIds.push(id)
    }

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { role, sedeIds } }
  }
)

/* ------------------------------------------------------------------ */
/* 5. Directorio fiscal de pacientes/clientes (`FiscalProfile`)        */
/* ------------------------------------------------------------------ */

export type PacienteFiscalInput = {
  tipoDocumento: TipoDocumentoFiscal
  documentoIdentidad: string
  razonSocial: string
  direccionFiscal: string
}

export const pacienteFiscalSchema = crearEsquema<PacienteFiscalInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const tipoDocumento = enumerado<TipoDocumentoFiscal>(
      ctx,
      "tipoDocumento",
      "El tipo de documento",
      datos.tipoDocumento,
      TIPOS_DOCUMENTO,
      null
    )

    const documentoCrudo = textoRequerido(
      ctx,
      "documentoIdentidad",
      "El documento de identidad",
      datos.documentoIdentidad,
      { min: 5, max: 20 }
    )
    const documento =
      tipoDocumento === "P"
        ? normalizarDocumentoIdentidad(documentoCrudo, "P")
        : tipoDocumento === "J" || tipoDocumento === "G"
          ? normalizarRif(documentoCrudo)
          : normalizarDocumentoIdentidad(documentoCrudo, tipoDocumento)
    if (!documento) {
      ctx.issues.push({
        campo: "documentoIdentidad",
        mensaje:
          tipoDocumento === "J" || tipoDocumento === "G"
            ? "El RIF debe tener el formato J-00000000-0."
            : tipoDocumento === "P"
              ? "El pasaporte debe ser alfanumérico (5 a 15 caracteres)."
              : `La cédula de ${tipoDocumento} debe tener entre 6 y 9 dígitos (ej. ${tipoDocumento}-12345678).`,
      })
    }

    const razonSocial = textoRequerido(
      ctx,
      "razonSocial",
      "El nombre o razón social a facturar",
      datos.razonSocial,
      { min: 3, max: 160 }
    )

    const direccionFiscal = textoRequerido(
      ctx,
      "direccionFiscal",
      "La dirección fiscal",
      datos.direccionFiscal,
      { min: 5, max: 300 }
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return {
      success: true,
      data: {
        tipoDocumento,
        documentoIdentidad: documento ?? documentoCrudo.toUpperCase(),
        razonSocial,
        direccionFiscal,
      },
    }
  }
)



