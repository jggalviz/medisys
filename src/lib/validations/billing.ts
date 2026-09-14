/**
 * MEDISYS · Validaciones del Módulo 2 (Facturación y Cobros)
 * -----------------------------------------------------------
 * Esquemas de entrada para:
 *   1. Perfil fiscal del cliente en la factura (RIF/Cédula, razón social…).
 *   2. Líneas de la factura (servicio, cantidad, precio, IVA, médico).
 *   3. Emisión de factura (con cobro opcional en el mismo paso).
 *   4. Registro de cobros multimoneda + IGTF.
 *   5. Anulación / notas de crédito y débito.
 *   6. Filtros del listado de facturas.
 *
 * Reutiliza las primitivas de `./core` (misma API que Zod) y la validación
 * fiscal del Módulo 1 (`pacienteFiscalSchema`), de modo que los requisitos del
 * SENIAT sean idénticos en todo el sistema.
 */
import type {
  InvoicePaymentStatus,
  InvoiceStatus,
  PaymentMethod,
} from "@/types/database"
import { METODOS_COBRO, infoMetodoCobro } from "@/lib/billing-ve"
import { esUuid } from "@/lib/fiscal-ve"
import { pacienteFiscalSchema } from "./admin"
import type { Contexto } from "./core"
import {
  booleano,
  comoArreglo,
  comoObjeto,
  crearEsquema,
  decimalRequerido,
  enumerado,
  error,
  enteroRequerido,
  textoOpcional,
  textoRequerido,
  uuidOpcional,
} from "./core"

/* ------------------------------------------------------------------ */
/* 1. Perfil fiscal del cliente en la factura                         */
/* ------------------------------------------------------------------ */

export type PerfilFiscalFacturaInput = {
  tipoDocumento: "V" | "E" | "J" | "G" | "P"
  documentoIdentidad: string
  razonSocial: string
  direccionFiscal: string
  email: string | null
  telefono: string | null
  pacienteNombre: string | null
}

export const perfilFiscalFacturaSchema =
  crearEsquema<PerfilFiscalFacturaInput>((entrada) => {
    const datos = comoObjeto(entrada)

    // Los 4 campos obligatorios los valida el esquema fiscal del Módulo 1
    // (mismos requisitos de RIF/Cédula que el resto del sistema).
    const fiscal = pacienteFiscalSchema.safeParse(datos)
    if (!fiscal.success) return fiscal

    const ctx: Contexto = { issues: [] }
    const email = textoOpcional(ctx, "email", "El correo", datos.email, {
      max: 160,
    })
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      ctx.issues.push({
        campo: "email",
        mensaje: "El correo del cliente no tiene un formato válido.",
      })
    }

    const telefono = textoOpcional(
      ctx,
      "telefono",
      "El teléfono",
      datos.telefono,
      { max: 30 }
    )
    const pacienteNombre = textoOpcional(
      ctx,
      "pacienteNombre",
      "El nombre del paciente",
      datos.pacienteNombre,
      { max: 160 }
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }

    return {
      success: true,
      data: {
        ...fiscal.data,
        email: email?.toLowerCase() ?? null,
        telefono,
        pacienteNombre,
      },
    }
  })

/* ------------------------------------------------------------------ */
/* 2. Líneas de la factura                                            */
/* ------------------------------------------------------------------ */

export type FacturaItemInput = {
  serviceId: string | null
  description: string
  quantity: number
  unitPriceUSD: number
  taxable: boolean
  doctorId: string | null
}

export const facturaItemSchema = crearEsquema<FacturaItemInput>((entrada) => {
  const ctx: Contexto = { issues: [] }
  const datos = comoObjeto(entrada)

  const serviceId = uuidOpcional(ctx, "serviceId", "El servicio", datos.serviceId)
  const description = textoRequerido(
    ctx,
    "description",
    "La descripción",
    datos.description,
    { min: 2, max: 200 }
  )
  const quantity = enteroRequerido(
    ctx,
    "quantity",
    "La cantidad",
    datos.quantity ?? 1,
    { min: 1, max: 999 }
  )
  const unitPriceUSD = decimalRequerido(
    ctx,
    "unitPriceUSD",
    "El precio unitario",
    datos.unitPriceUSD,
    { min: 0, max: 1_000_000 }
  )
  const taxable = booleano(datos.taxable, false)
  const doctorId = uuidOpcional(ctx, "doctorId", "El especialista", datos.doctorId)

  if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
  return {
    success: true,
    data: { serviceId, description, quantity, unitPriceUSD, taxable, doctorId },
  }
})

/* ------------------------------------------------------------------ */
/* 3. Registro de cobros (IGTF)                                       */
/* ------------------------------------------------------------------ */

/** Convierte un valor crudo a número solo si viene informado ("" → null). */
function comoTextoNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null
  const limpio = String(valor).replace(",", ".").trim()
  if (!limpio) return null
  const numero = Number(limpio)
  return Number.isFinite(numero) ? numero : null
}

export type RegistrarPagoInput = {
  method: PaymentMethod
  amountUSD: number | null
  amountVES: number | null
  referenceNumber: string | null
  notes: string | null
  /** true → el cobro entra como VERIFIED (caja con confirmación inmediata). */
  verificar: boolean
}

export const registrarPagoSchema = crearEsquema<RegistrarPagoInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const method = enumerado<PaymentMethod>(
      ctx,
      "method",
      "El método de cobro",
      datos.method,
      METODOS_COBRO,
      null
    )
    const info = infoMetodoCobro(method)

    const montoUSDBruto = comoTextoNumero(datos.amountUSD)
    const montoVESBruto = comoTextoNumero(datos.amountVES)

    const amountUSD =
      montoUSDBruto === null || montoUSDBruto <= 0
        ? null
        : decimalRequerido(
            ctx,
            "amountUSD",
            "El monto en USD",
            montoUSDBruto,
            { min: 0.01, max: 1_000_000 }
          )
    const amountVES =
      montoVESBruto === null || montoVESBruto <= 0
        ? null
        : decimalRequerido(ctx, "amountVES", "El monto en Bs.", montoVESBruto, {
            min: 0.01,
            max: 100_000_000,
          })

    if (amountUSD === null && amountVES === null) {
      ctx.issues.push({
        campo: "amountUSD",
        mensaje:
          "Indica el monto cobrado (en dólares o en bolívares) para registrar el pago.",
      })
    }

    const referenciaBruta = textoOpcional(
      ctx,
      "referenceNumber",
      "La referencia",
      datos.referenceNumber,
      { max: 24 }
    )
    const referenceNumber = referenciaBruta
      ? referenciaBruta.replace(/\s+/g, "-").toUpperCase()
      : null

    if (info.requiereReferencia && !referenceNumber) {
      ctx.issues.push({
        campo: "referenceNumber",
        mensaje: `${info.label} requiere el número de referencia (últimos 4 a 6 dígitos o código de confirmación).`,
      })
    } else if (referenceNumber && !/^[A-Z0-9-]{4,24}$/.test(referenceNumber)) {
      ctx.issues.push({
        campo: "referenceNumber",
        mensaje:
          "La referencia debe tener entre 4 y 24 caracteres alfanuméricos.",
      })
    }

    const notes = textoOpcional(ctx, "notes", "La nota", datos.notes, {
      max: 300,
    })
    const verificar = booleano(datos.verificar, false)

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return {
      success: true,
      data: { method, amountUSD, amountVES, referenceNumber, notes, verificar },
    }
  }
)

/* ------------------------------------------------------------------ */
/* 4. Emisión de factura (con cobro opcional en el mismo paso)        */
/* ------------------------------------------------------------------ */

export type EmitirFacturaInput = {
  sedeId: string | null
  patientId: string | null
  appointmentId: string | null
  fiscalProfile: PerfilFiscalFacturaInput
  items: FacturaItemInput[]
  /** Tasa BCV a aplicar; `null` = usar la tasa vigente del sistema. */
  bcvRate: number | null
  /** false → se guarda como borrador (sin numeración fiscal). */
  emitir: boolean
  notas: string | null
  /** Cobro inmediato (cierre de consulta en caja). */
  cobro: RegistrarPagoInput | null
}

export const emitirFacturaSchema = crearEsquema<EmitirFacturaInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const sedeId = uuidOpcional(ctx, "sedeId", "La sede", datos.sedeId)
    const patientId = uuidOpcional(ctx, "patientId", "El paciente", datos.patientId)
    const appointmentId = uuidOpcional(
      ctx,
      "appointmentId",
      "La cita",
      datos.appointmentId
    )

    // Datos fiscales del cliente (obligatorios para emitir).
    const perfil = perfilFiscalFacturaSchema.safeParse(
      datos.fiscalProfile ?? datos.perfilFiscal
    )
    if (!perfil.success) {
      ctx.issues.push(...perfil.error.issues)
    }

    // Líneas de la factura.
    const itemsBrutos = comoArreglo(datos.items)
    if (itemsBrutos.length === 0) {
      ctx.issues.push({
        campo: "items",
        mensaje: "Agrega al menos un servicio o concepto a la factura.",
      })
    } else if (itemsBrutos.length > 50) {
      ctx.issues.push({
        campo: "items",
        mensaje: "Una factura no puede tener más de 50 líneas.",
      })
    }

    const items: FacturaItemInput[] = []
    itemsBrutos.forEach((item, indice) => {
      const valido = facturaItemSchema.safeParse(item)
      if (valido.success) {
        items.push(valido.data)
        return
      }
      ctx.issues.push(
        ...valido.error.issues.map((issue) => ({
          campo: `items[${indice}].${issue.campo}`,
          mensaje: issue.mensaje,
        }))
      )
    })

    const tasaBruta = comoTextoNumero(datos.bcvRate)
    const bcvRate =
      tasaBruta === null || tasaBruta <= 0
        ? null
        : decimalRequerido(ctx, "bcvRate", "La tasa BCV", tasaBruta, {
            min: 0.0001,
            max: 1_000_000,
            decimales: 4,
          })

    const emitir = booleano(datos.emitir, true)
    const notas = textoOpcional(ctx, "notas", "La nota", datos.notas, {
      max: 500,
    })

    let cobro: RegistrarPagoInput | null = null
    if (datos.cobro !== undefined && datos.cobro !== null) {
      const valido = registrarPagoSchema.safeParse(datos.cobro)
      if (valido.success) {
        cobro = valido.data
      } else {
        ctx.issues.push(
          ...valido.error.issues.map((issue) => ({
            campo: `cobro.${issue.campo}`,
            mensaje: issue.mensaje,
          }))
        )
      }
    }

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    if (!perfil.success) return { success: false, error: error(ctx) }

    return {
      success: true,
      data: {
        sedeId,
        patientId,
        appointmentId,
        fiscalProfile: perfil.data,
        items,
        bcvRate,
        emitir,
        notas,
        cobro,
      },
    }
  }
)

/* ------------------------------------------------------------------ */
/* 5. Anulación / notas de ajuste fiscal                              */
/* ------------------------------------------------------------------ */

export const TIPOS_NOTA_AJUSTE = ["CREDITO", "DEBITO"] as const
export type TipoNotaAjuste = (typeof TIPOS_NOTA_AJUSTE)[number]

export const TIPO_NOTA_LABEL: Record<TipoNotaAjuste, string> = {
  CREDITO: "Nota de crédito (anulación / ajuste a favor)",
  DEBITO: "Nota de débito (cargo adicional)",
}

export type AnularFacturaInput = {
  tipo: TipoNotaAjuste
  /** Motivo de emisión: obligatorio y queda registrado en la nota. */
  motivo: string
  /** `null` → se usa el total pendiente de la factura. */
  montoUSD: number | null
  /** true → marca la factura como REFUNDED (dinero devuelto). */
  reembolsar: boolean
}

export const anularFacturaSchema = crearEsquema<AnularFacturaInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const tipo = enumerado<TipoNotaAjuste>(
      ctx,
      "tipo",
      "El tipo de nota",
      datos.tipo,
      TIPOS_NOTA_AJUSTE,
      "CREDITO"
    )
    const motivo = textoRequerido(ctx, "motivo", "El motivo", datos.motivo, {
      min: 5,
      max: 300,
    })

    const montoBruto = comoTextoNumero(datos.montoUSD)
    const montoUSD =
      montoBruto === null || montoBruto <= 0
        ? null
        : decimalRequerido(ctx, "montoUSD", "El monto en USD", montoBruto, {
            min: 0.01,
            max: 1_000_000,
          })

    const reembolsar = booleano(datos.reembolsar, false)

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return { success: true, data: { tipo, motivo, montoUSD, reembolsar } }
  }
)

/* ------------------------------------------------------------------ */
/* 6. Filtros del listado de facturas                                 */
/* ------------------------------------------------------------------ */

export const ESTADOS_FACTURA: readonly InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "CANCELLED",
  "REFUNDED",
]

export const ESTADOS_COBRO: readonly InvoicePaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
]

export type FacturaFiltrosInput = {
  desde: string | null
  hasta: string | null
  sedeId: string | null
  status: InvoiceStatus | "TODAS"
  paymentStatus: InvoicePaymentStatus | "TODAS"
  patientId: string | null
  q: string | null
  limite: number
}

export const facturaFiltrosSchema = crearEsquema<FacturaFiltrosInput>(
  (entrada) => {
    const ctx: Contexto = { issues: [] }
    const datos = comoObjeto(entrada)

    const desde = fechaFiltro(ctx, "desde", "La fecha inicial", datos.desde)
    const hasta = fechaFiltro(ctx, "hasta", "La fecha final", datos.hasta)
    if (desde && hasta && desde > hasta) {
      ctx.issues.push({
        campo: "hasta",
        mensaje: "La fecha final no puede ser anterior a la inicial.",
      })
    }

    const sedeId = uuidOpcional(ctx, "sedeId", "La sede", datos.sedeId)
    const patientId = uuidOpcional(ctx, "patientId", "El paciente", datos.patientId)
    const status = enumerado<InvoiceStatus | "TODAS">(
      ctx,
      "status",
      "El estado",
      datos.status,
      [...ESTADOS_FACTURA, "TODAS"],
      "TODAS"
    )
    const paymentStatus = enumerado<InvoicePaymentStatus | "TODAS">(
      ctx,
      "paymentStatus",
      "El estado de cobro",
      datos.paymentStatus,
      [...ESTADOS_COBRO, "TODAS"],
      "TODAS"
    )
    const q = textoOpcional(ctx, "q", "La búsqueda", datos.q, { max: 60 })
    const limite = enteroRequerido(
      ctx,
      "limite",
      "El límite",
      datos.limite ?? 100,
      { min: 1, max: 200 }
    )

    if (ctx.issues.length > 0) return { success: false, error: error(ctx) }
    return {
      success: true,
      data: { desde, hasta, sedeId, patientId, status, paymentStatus, q, limite },
    }
  }
)

/** Fecha ISO opcional para filtros (vacío = sin límite). */
function fechaFiltro(
  ctx: Contexto,
  campo: string,
  etiqueta: string,
  valor: unknown
): string | null {
  const limpio = textoOpcional(ctx, campo, etiqueta, valor, { max: 10 })
  if (!limpio) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    ctx.issues.push({
      campo,
      mensaje: `${etiqueta} debe tener el formato YYYY-MM-DD.`,
    })
  }
  return limpio
}

/** Re-exporta el helper de ids válidos para consumidores de este módulo. */
export { esUuid }
