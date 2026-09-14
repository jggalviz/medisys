/**
 * MEDISYS · Servicio de facturación y cobros (Módulo 2)
 * ------------------------------------------------------
 * Capa de servidor compartida por las API `/api/admin/invoices/*` y las
 * páginas del panel. Responsabilidades:
 *
 *   1. Punteros fiscales (`fiscal_counters`): correlativo de factura y N° de
 *      control, con incremento seguro por compare-and-swap.
 *   2. Emisión de facturas con doble despliegue USD/VES, IVA y honorarios.
 *   3. Cobros multimoneda con IGTF del 3% en divisas y recálculo del estado.
 *   4. Notas de crédito/débito vinculadas (anulación y cargos adicionales).
 *
 * Ninguna función lanza: todas devuelven `AdminModuleResult` para que la API
 * traduzca el código a un HTTP coherente.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AdminModuleErrorCode, AdminModuleResult } from "@/types/admin"
import type {
  FacturaDTO,
  FacturaFiltros,
  FacturaItemDTO,
  NotaAjusteDTO,
  PagoDTO,
  RespuestaAnulacion,
  RespuestaCobro,
} from "@/types/billing"
import type {
  Database,
  FiscalCounter,
  FiscalDocType,
  Invoice,
  InvoiceFiscalProfile,
  InvoiceItem,
  InvoicePaymentStatus,
  InvoiceStatus,
  Payment,
  PaymentStatus,
} from "@/types/database"
import {
  aVes,
  calcularLineaFactura,
  calcularTotalesFactura,
  desglosarCobro,
  faltantesDatosFiscales,
  formatearNumeroControl,
  formatearNumeroFactura,
  recalcularEstadoCobro,
} from "@/lib/billing-ve"
import { calcularHonorarioMedico, redondear2 } from "@/lib/fiscal-ve"
import { aServicioDTO } from "@/lib/admin/servicios"
import { getTasaVigente } from "@/lib/currency-rates"
import type {
  AnularFacturaInput,
  EmitirFacturaInput,
  RegistrarPagoInput,
} from "@/lib/validations/billing"
import {
  anularFacturaSchema,
  emitirFacturaSchema,
  facturaFiltrosSchema,
  registrarPagoSchema,
} from "@/lib/validations/billing"

type Client = SupabaseClient<Database>
type ErrorBd = { code?: string; message?: string } | null

const SERIE_DEFECTO = "A"
const MAX_REINTENTOS_NUMERACION = 4

/** Traduce errores de Postgres/PostgREST a un código y mensaje accionable. */
export function interpretarErrorFacturacion(error: ErrorBd): {
  code: AdminModuleErrorCode
  message: string
} {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return {
      code: "MIGRACION_PENDIENTE",
      message:
        "Falta aplicar la migración 0017_billing_module.sql: las tablas de facturación aún no existen en la base de datos.",
    }
  }
  if (error?.code === "23505") {
    return {
      code: "CONFLICT",
      message:
        "Ese número de factura o de control ya fue usado. Revisa los punteros fiscales en Configuración.",
    }
  }
  if (error?.code === "23503") {
    return {
      code: "NOT_FOUND",
      message:
        "Alguno de los datos referenciados (paciente, sede, servicio o especialista) no existe en esta clínica.",
    }
  }
  if (error?.code === "23514") {
    return {
      code: "INVALID_INPUT",
      message: `Alguno de los valores no cumple las reglas fiscales: ${error.message ?? "restricción violada"}.`,
    }
  }
  return {
    code: "SERVER_ERROR",
    message: `No se pudo completar la operación: ${error?.message ?? "error desconocido"}.`,
  }
}

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function textoONull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null
}

/* ------------------------------------------------------------------ */
/* Punteros fiscales (numeración + N° de control)                     */
/* ------------------------------------------------------------------ */

export type NumeracionFiscal = { invoiceNumber: string; controlNumber: string }

type ContadorLeido =
  | { ok: true; fila: FiscalCounter | null }
  | { ok: false; code: AdminModuleErrorCode; message: string }

/** Lee el contador de un tenant (por sede o global si `sedeId` es null). */
async function leerContador(
  supabase: Client,
  tenantId: string,
  sedeId: string | null,
  docType: FiscalDocType
): Promise<ContadorLeido> {
  const base = supabase
    .from("fiscal_counters")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("doc_type", docType)
    .eq("series", SERIE_DEFECTO)

  const { data, error } = await (sedeId
    ? base.eq("sede_id", sedeId)
    : base.is("sede_id", null)
  ).maybeSingle()

  if (error) {
    const info = interpretarErrorFacturacion(error)
    return { ok: false, code: info.code, message: info.message }
  }
  return { ok: true, fila: data ?? null }
}

/**
 * Reserva el siguiente correlativo de factura y N° de control.
 *
 * Estrategia: compare-and-swap sobre `fiscal_counters` (se actualiza solo si
 * los correlativos siguen siendo los leídos). Si otro proceso ganó la carrera
 * se relee y se reintenta, evitando duplicar números fiscales.
 */
export async function siguienteNumeracion(
  supabase: Client,
  tenantId: string,
  sedeId: string | null,
  docType: FiscalDocType
): Promise<AdminModuleResult<NumeracionFiscal>> {
  try {
    const contador = await leerContador(supabase, tenantId, sedeId, docType)
    if (!contador.ok) {
      return { ok: false, code: contador.code, message: contador.message }
    }

    let fila = contador.fila

    // Primera emisión de la clínica/sede: se crea el puntero por defecto.
    if (!fila) {
      const creado = await supabase
        .from("fiscal_counters")
        .insert({
          tenant_id: tenantId,
          sede_id: sedeId,
          doc_type: docType,
          series: SERIE_DEFECTO,
        })
        .select("*")
        .maybeSingle()

      if (creado.error && creado.error.code !== "23505") {
        const info = interpretarErrorFacturacion(creado.error)
        return { ok: false, code: info.code, message: info.message }
      }
      fila = creado.data ?? null

      if (!fila) {
        const releido = await leerContador(supabase, tenantId, sedeId, docType)
        if (!releido.ok) {
          return { ok: false, code: releido.code, message: releido.message }
        }
        fila = releido.fila
      }
    }

    // Sin contador propio de la sede → se usa la serie global de la clínica.
    if (!fila && sedeId) {
      const global = await leerContador(supabase, tenantId, null, docType)
      if (global.ok) fila = global.fila
    }

    if (!fila) {
      return {
        ok: false,
        code: "MIGRACION_PENDIENTE",
        message:
          "No hay punteros fiscales (fiscal_counters) para esta clínica. Aplica la migración 0017_billing_module.sql.",
      }
    }

    for (let intento = 0; intento < MAX_REINTENTOS_NUMERACION; intento += 1) {
      const correlativo = Number(fila.next_invoice_number) || 1
      const control = Number(fila.next_control_number) || 1

      const { data, error } = await supabase
        .from("fiscal_counters")
        .update({
          next_invoice_number: correlativo + 1,
          next_control_number: control + 1,
        })
        .eq("id", fila.id)
        .eq("next_invoice_number", correlativo)
        .eq("next_control_number", control)
        .select("*")
        .maybeSingle()

      if (error) {
        const info = interpretarErrorFacturacion(error)
        return { ok: false, code: info.code, message: info.message }
      }

      if (data) {
        return {
          ok: true,
          data: {
            invoiceNumber: formatearNumeroFactura(correlativo, fila.invoice_prefix),
            controlNumber: formatearNumeroControl(control, fila.control_prefix),
          },
        }
      }

      // Otro proceso reservó antes: se relee el puntero y se reintenta.
      const releido = await leerContador(supabase, tenantId, fila.sede_id, docType)
      if (!releido.ok || !releido.fila) break
      fila = releido.fila
    }

    return {
      ok: false,
      code: "CONFLICT",
      message:
        "No se pudo reservar la numeración fiscal (concurrencia detectada). Vuelve a intentar la emisión.",
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al reservar la numeración fiscal.",
    }
  }
}

/** Estado actual de los punteros (para la vista de configuración). */
export async function leerPunterosFiscales(
  supabase: Client,
  tenantId: string
): Promise<AdminModuleResult<FiscalCounter[]>> {
  try {
    const { data, error } = await supabase
      .from("fiscal_counters")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("doc_type", { ascending: true })

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    return { ok: true, data: (data ?? []) as FiscalCounter[] }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al leer los punteros fiscales.",
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mappers de fila → DTO                                              */
/* ------------------------------------------------------------------ */

export function aPagoDTO(fila: Payment): PagoDTO {
  return {
    id: fila.id,
    invoiceId: fila.invoice_id,
    sedeId: fila.sede_id,
    method: fila.method,
    amountUSD: numero(fila.amount_usd),
    amountVES: numero(fila.amount_ves),
    referenceNumber: fila.reference_number,
    appliesIgtf: Boolean(fila.applies_igtf),
    igtfAmountUSD: numero(fila.igtf_amount),
    igtfAmountVES: numero(fila.igtf_amount_ves),
    status: fila.status as PaymentStatus,
    notes: fila.notes,
    verifiedAt: fila.verified_at,
    createdAt: fila.created_at,
  }
}

export function aFacturaItemDTO(fila: InvoiceItem, tasa: number): FacturaItemDTO {
  const cantidad = numero(fila.quantity) || 1
  const precio = numero(fila.unit_price_usd)
  const subtotal = redondear2(precio * cantidad)
  const alicuota = fila.taxable ? 0.16 : 0
  const iva = redondear2(subtotal * alicuota)

  return {
    id: fila.id,
    serviceId: fila.service_id,
    description: fila.description,
    quantity: cantidad,
    unitPriceUSD: precio,
    unitPriceVES: numero(fila.unit_price_ves) || aVes(precio, tasa),
    taxable: Boolean(fila.taxable),
    alicuotaIva: alicuota,
    subtotalUSD: subtotal,
    subtotalVES: aVes(subtotal, tasa),
    ivaUSD: iva,
    ivaVES: aVes(iva, tasa),
    totalUSD: redondear2(subtotal + iva),
    totalVES: aVes(subtotal + iva, tasa),
    doctorId: fila.doctor_id,
    doctorCommissionAmount: numero(fila.doctor_commission_amount),
    doctorCommissionType: null,
  }
}

/** Nota de crédito o débito → DTO. */
export function aNotaAjusteDTO(
  fila: {
    id: string
    invoice_id: string
    note_number: string | null
    control_number: string | null
    amount_usd: number | string | null
    amount_ves: number | string | null
    motivo: string
    created_at: string
    reembolsada?: boolean | null
  },
  tipo: "CREDITO" | "DEBITO"
): NotaAjusteDTO {
  return {
    id: fila.id,
    tipo,
    noteNumber: fila.note_number,
    controlNumber: fila.control_number,
    amountUSD: numero(fila.amount_usd),
    amountVES: numero(fila.amount_ves),
    motivo: fila.motivo ?? "",
    reembolsada: Boolean(fila.reembolsada),
    createdAt: fila.created_at,
  }
}

/** Forma mínima de una fila de `credit_notes`/`debit_notes` para el DTO. */
type FilaNota = Parameters<typeof aNotaAjusteDTO>[0]

/** Datos auxiliares para armar el DTO de factura. */
type ContextoFactura = {
  items: InvoiceItem[]
  pagos: Payment[]
  notas: NotaAjusteDTO[]
  nombresSede: Map<string, string>
  nombresPaciente: Map<string, string>
}

/** Fila de factura + detalle → DTO de aplicación (camelCase). */
export function aFacturaDTO(
  fila: Invoice,
  contexto: ContextoFactura
): FacturaDTO {
  const tasa = numero(fila.bcv_rate_used)
  const items = contexto.items.map((item) => aFacturaItemDTO(item, tasa))
  const pagos = contexto.pagos.map(aPagoDTO)
  const estado = recalcularEstadoCobro(
    {
      subtotalUSD: numero(fila.subtotal_usd),
      vatUSD: numero(fila.vat_amount_usd),
      totalUSD: numero(fila.total_usd),
    },
    pagos
  )
  const perfil = (fila.fiscal_profile ?? {}) as InvoiceFiscalProfile

  return {
    id: fila.id,
    tenantId: fila.tenant_id,
    sedeId: fila.sede_id,
    sedeNombre: fila.sede_id ? contexto.nombresSede.get(fila.sede_id) ?? null : null,
    invoiceNumber: fila.invoice_number,
    controlNumber: fila.control_number,
    patientId: fila.patient_id,
    patientNombre: fila.patient_id
      ? contexto.nombresPaciente.get(fila.patient_id) ?? null
      : null,
    appointmentId: fila.appointment_id,
    fiscalProfile: {
      tipoDocumento: perfil.tipoDocumento ?? "V",
      documentoIdentidad: perfil.documentoIdentidad ?? "",
      razonSocial: perfil.razonSocial ?? "",
      direccionFiscal: perfil.direccionFiscal ?? "",
      email: perfil.email ?? null,
      telefono: perfil.telefono ?? null,
      pacienteNombre: perfil.pacienteNombre ?? null,
    },
    subtotalUSD: numero(fila.subtotal_usd),
    subtotalVES: numero(fila.subtotal_ves),
    vatUSD: numero(fila.vat_amount_usd),
    vatVES: numero(fila.vat_amount_ves),
    igtfUSD: numero(fila.igtf_amount_usd),
    igtfVES: numero(fila.igtf_amount_ves),
    totalUSD: numero(fila.total_usd),
    totalVES: numero(fila.total_ves),
    bcvRate: tasa,
    status: fila.status as InvoiceStatus,
    paymentStatus: fila.payment_status as InvoicePaymentStatus,
    notes: textoONull(fila.notes),
    createdBy: fila.created_by,
    issuedAt: fila.issued_at,
    cancelledAt: fila.cancelled_at,
    createdAt: fila.created_at,
    items,
    pagos,
    notas: contexto.notas,
    pagadoUSD: estado.pagadoUSD,
    saldoUSD: estado.saldoUSD,
  }
}

/* ------------------------------------------------------------------ */
/* Lecturas                                                           */
/* ------------------------------------------------------------------ */

/**
 * Completa las facturas con su detalle, cobros, notas y nombres de sede y
 * paciente. Consulta por lote (una vez por tabla) para evitar N+1.
 */
async function hidratarFacturas(
  supabase: Client,
  filas: Invoice[]
): Promise<FacturaDTO[]> {
  if (filas.length === 0) return []

  const ids = filas.map((fila) => fila.id)
  const sedeIds = Array.from(
    new Set(
      filas.map((fila) => fila.sede_id).filter((id): id is string => Boolean(id))
    )
  )
  const patientIds = Array.from(
    new Set(
      filas
        .map((fila) => fila.patient_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const [items, pagos, creditos, debitos, sedes, pacientes] = await Promise.all([
    supabase.from("invoice_items").select("*").in("invoice_id", ids),
    supabase.from("payments").select("*").in("invoice_id", ids),
    supabase.from("credit_notes").select("*").in("invoice_id", ids),
    supabase.from("debit_notes").select("*").in("invoice_id", ids),
    sedeIds.length > 0
      ? supabase.from("sedes").select("id, nombre").in("id", sedeIds)
      : Promise.resolve({ data: [], error: null }),
    patientIds.length > 0
      ? supabase.from("profiles").select("id, nombres, apellidos").in("id", patientIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const itemsPorFactura = new Map<string, InvoiceItem[]>()
  for (const item of (items.data ?? []) as InvoiceItem[]) {
    const lista = itemsPorFactura.get(item.invoice_id) ?? []
    lista.push(item)
    itemsPorFactura.set(item.invoice_id, lista)
  }

  const pagosPorFactura = new Map<string, Payment[]>()
  for (const pago of (pagos.data ?? []) as Payment[]) {
    const lista = pagosPorFactura.get(pago.invoice_id) ?? []
    lista.push(pago)
    pagosPorFactura.set(pago.invoice_id, lista)
  }

  const notasPorFactura = new Map<string, NotaAjusteDTO[]>()
  const creditosLeidos = (creditos.data ?? []) as unknown as FilaNota[]
  const debitosLeidos = (debitos.data ?? []) as unknown as FilaNota[]

  for (const nota of creditosLeidos) {
    const lista = notasPorFactura.get(nota.invoice_id) ?? []
    lista.push(aNotaAjusteDTO(nota, "CREDITO"))
    notasPorFactura.set(nota.invoice_id, lista)
  }
  for (const nota of debitosLeidos) {
    const lista = notasPorFactura.get(nota.invoice_id) ?? []
    lista.push(aNotaAjusteDTO(nota, "DEBITO"))
    notasPorFactura.set(nota.invoice_id, lista)
  }

  const nombresSede = new Map<string, string>()
  for (const sede of (sedes.data ?? []) as Array<{ id: string; nombre: string }>) {
    nombresSede.set(sede.id, sede.nombre)
  }

  const nombresPaciente = new Map<string, string>()
  for (const perfil of (pacientes.data ?? []) as Array<{
    id: string
    nombres: string | null
    apellidos: string | null
  }>) {
    nombresPaciente.set(
      perfil.id,
      [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ").trim() ||
        "Paciente"
    )
  }

  return filas.map((fila) =>
    aFacturaDTO(fila, {
      items: itemsPorFactura.get(fila.id) ?? [],
      pagos: pagosPorFactura.get(fila.id) ?? [],
      notas: notasPorFactura.get(fila.id) ?? [],
      nombresSede,
      nombresPaciente,
    })
  )
}

/** Lista las facturas del tenant aplicando filtros de período/estado/sede. */
export async function listarFacturas(
  supabase: Client,
  tenantId: string,
  filtros: Partial<FacturaFiltros> = {}
): Promise<AdminModuleResult<FacturaDTO[]>> {
  const valido = facturaFiltrosSchema.safeParse(filtros)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const f = valido.data

  try {
    let consulta = supabase.from("invoices").select("*").eq("tenant_id", tenantId)

    if (f.desde) consulta = consulta.gte("created_at", `${f.desde}T00:00:00-04:00`)
    if (f.hasta) consulta = consulta.lte("created_at", `${f.hasta}T23:59:59-04:00`)
    if (f.sedeId) consulta = consulta.eq("sede_id", f.sedeId)
    if (f.patientId) consulta = consulta.eq("patient_id", f.patientId)
    if (f.status !== "TODAS") consulta = consulta.eq("status", f.status)
    if (f.paymentStatus !== "TODAS") {
      consulta = consulta.eq("payment_status", f.paymentStatus)
    }

    const { data, error } = await consulta
      .order("created_at", { ascending: false })
      .limit(f.limite)

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }

    const facturas = await hidratarFacturas(supabase, (data ?? []) as Invoice[])

    // La búsqueda libre (N° de factura/control o razón social) se resuelve en
    // memoria: `fiscal_profile` es jsonb y ya viene hidratado.
    if (!f.q) return { ok: true, data: facturas }

    const termino = f.q.toLowerCase()
    const filtradas = facturas.filter((factura) =>
      [
        factura.invoiceNumber,
        factura.controlNumber,
        factura.fiscalProfile.razonSocial,
        factura.fiscalProfile.documentoIdentidad,
        factura.patientNombre,
        factura.sedeNombre,
      ].some((campo) => campo?.toLowerCase().includes(termino))
    )

    return { ok: true, data: filtradas }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al listar las facturas.",
    }
  }
}

/** Obtiene una factura con su detalle, cobros y notas. */
export async function obtenerFactura(
  supabase: Client,
  tenantId: string,
  facturaId: string
): Promise<AdminModuleResult<FacturaDTO>> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", facturaId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La factura no existe en esta clínica.",
      }
    }

    const [factura] = await hidratarFacturas(supabase, [data as Invoice])
    return { ok: true, data: factura }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al consultar la factura.",
    }
  }
}

/* ------------------------------------------------------------------ */
/* Emisión de facturas                                                */
/* ------------------------------------------------------------------ */

type LineasConstruidas =
  | { ok: true; data: FacturaItemDTO[] }
  | { ok: false; code: AdminModuleErrorCode; message: string }

/**
 * Resuelve cada línea contra el catálogo de servicios (módulo 1) para tomar
 * precio, tratamiento de IVA y honorario del especialista. El operador puede
 * sobreescribir el precio unitario y marcar IVA manualmente.
 */
async function construirLineas(
  supabase: Client,
  tenantId: string,
  items: EmitirFacturaInput["items"],
  tasa: number
): Promise<LineasConstruidas> {
  const idsServicio = Array.from(
    new Set(
      items
        .map((item) => item.serviceId)
        .filter((id): id is string => Boolean(id))
    )
  )

  const catalogo = new Map<string, ReturnType<typeof aServicioDTO>>()
  if (idsServicio.length > 0) {
    const { data, error } = await supabase
      .from("medical_services")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("id", idsServicio)

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    for (const fila of data ?? []) {
      const dto = aServicioDTO(fila as Record<string, unknown>)
      catalogo.set(dto.id, dto)
    }
  }

  const lineas = items.map((item) => {
    const servicio = item.serviceId ? catalogo.get(item.serviceId) ?? null : null
    const precioUnitario =
      item.unitPriceUSD > 0 ? item.unitPriceUSD : servicio?.priceUSD ?? 0
    // El catálogo define si el servicio es gravado; el operador puede activarlo.
    const taxable = item.taxable || servicio?.taxable === true
    const doctorId = item.doctorId ?? servicio?.doctorId ?? null
    const comision = servicio
      ? calcularHonorarioMedico(
          precioUnitario * item.quantity,
          servicio.doctorCommissionType,
          servicio.doctorCommissionValue
        )
      : 0

    return calcularLineaFactura(
      {
        description: item.description,
        quantity: item.quantity,
        unitPriceUSD: precioUnitario,
        taxable,
        serviceId: servicio?.id ?? null,
        doctorId,
        doctorCommissionAmount: comision,
        doctorCommissionType: servicio?.doctorCommissionType ?? null,
      },
      tasa
    )
  })

  return { ok: true, data: lineas }
}

/**
 * Crea (y opcionalmente emite) una factura fiscal.
 *
 * Reglas aplicadas:
 *  - No se emite sin datos fiscales mínimos del cliente (RIF/Cédula, razón
 *    social y dirección) ni sin N° de control: se devuelve `INVALID_INPUT`
 *    explicando qué falta.
 *  - `emitir = false` guarda un borrador sin consumir numeración fiscal.
 *  - El cobro inmediato (cierre de consulta) se registra después de emitir.
 */
export async function crearFactura(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  entrada: unknown
): Promise<AdminModuleResult<FacturaDTO>> {
  const valido = emitirFacturaSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const datos = valido.data

  // Refuerzo de la regla SENIAT: datos fiscales mínimos del cliente.
  const faltantes = faltantesDatosFiscales(datos.fiscalProfile)
  if (faltantes.length > 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `Faltan datos fiscales del cliente: ${faltantes.join(", ")}.`,
      issues: faltantes.map((campo) => ({
        campo,
        mensaje: `${campo} es obligatorio para emitir la factura.`,
      })),
    }
  }

  try {
    // Tasa BCV aplicada en la fecha/hora del cobro.
    const tasa = datos.bcvRate ?? (await getTasaVigente(supabase)).rate
    if (!Number.isFinite(tasa) || tasa <= 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "La tasa BCV aplicada debe ser mayor que cero.",
      }
    }

    const lineas = await construirLineas(supabase, tenantId, datos.items, tasa)
    if (!lineas.ok) return lineas

    const totales = calcularTotalesFactura(lineas.data, { tasa })

    // Numeración fiscal (obligatoria al emitir).
    let invoiceNumber: string | null = null
    let controlNumber: string | null = null
    if (datos.emitir) {
      const numeracion = await siguienteNumeracion(
        supabase,
        tenantId,
        datos.sedeId,
        "INVOICE"
      )
      if (!numeracion.ok) return numeracion
      invoiceNumber = numeracion.data.invoiceNumber
      controlNumber = numeracion.data.controlNumber

      if (!invoiceNumber || !controlNumber) {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message:
            "No se pudo asignar el Número de Control (obligatorio para formas libres). Revisa los punteros fiscales en Configuración.",
        }
      }
    }

    const { data: factura, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        sede_id: datos.sedeId,
        invoice_number: invoiceNumber,
        control_number: controlNumber,
        patient_id: datos.patientId,
        appointment_id: datos.appointmentId,
        fiscal_profile: { ...datos.fiscalProfile },
        subtotal_usd: totales.subtotalUSD,
        subtotal_ves: totales.subtotalVES,
        vat_amount_usd: totales.vatUSD,
        vat_amount_ves: totales.vatVES,
        igtf_amount_usd: 0,
        igtf_amount_ves: 0,
        total_usd: totales.totalUSD,
        total_ves: totales.totalVES,
        bcv_rate_used: tasa,
        status: datos.emitir ? "ISSUED" : "DRAFT",
        payment_status: "PENDING",
        notes: datos.notas,
        created_by: usuarioId,
        issued_at: datos.emitir ? new Date().toISOString() : null,
      })
      .select("*")
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!factura) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "La factura no se guardó: tu usuario no tiene permisos de facturación en esta clínica.",
      }
    }

    // Detalle de la factura (una sola inserción por lote).
    const { error: errorItems } = await supabase.from("invoice_items").insert(
      lineas.data.map((linea, indice) => ({
        invoice_id: factura.id,
        tenant_id: tenantId,
        service_id: datos.items[indice]?.serviceId ?? null,
        description: linea.description,
        quantity: linea.quantity,
        unit_price_usd: linea.unitPriceUSD,
        unit_price_ves: linea.unitPriceVES,
        taxable: linea.taxable,
        doctor_id: linea.doctorId,
        doctor_commission_amount: linea.doctorCommissionAmount,
      }))
    )

    if (errorItems) {
      // Limpieza: no se dejan facturas sin detalle (consistencia fiscal).
      await supabase.from("invoices").delete().eq("id", factura.id)
      const info = interpretarErrorFacturacion(errorItems)
      return { ok: false, code: info.code, message: info.message }
    }

    // Cobro inmediato (opcional): cierre de consulta cobrando en un solo paso.
    if (datos.cobro) {
      const cobro = await registrarPagoValidado(
        supabase,
        tenantId,
        usuarioId,
        factura.id,
        datos.cobro
      )
      if (!cobro.ok) {
        return {
          ok: false,
          code: cobro.code,
          message: `La factura ${invoiceNumber ?? "(borrador)"} quedó registrada, pero el cobro no se pudo guardar: ${cobro.message}`,
        }
      }
    }

    return obtenerFactura(supabase, tenantId, factura.id)
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al emitir la factura.",
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cobros (con IGTF)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Registra un cobro ya validado y recalcula el estado de la factura:
 *  - IGTF 3% automático cuando el método es en divisas (Zelle, Efectivo USD).
 *  - `payment_status` (PENDING/PARTIAL/PAID) según los cobros VERIFICADOS.
 *  - `status` pasa a PAID cuando el saldo queda en cero.
 */
async function registrarPagoValidado(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  invoiceId: string,
  datos: RegistrarPagoInput
): Promise<AdminModuleResult<RespuestaCobro>> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La factura no existe en esta clínica.",
      }
    }

    const factura = data as Invoice
    if (factura.status === "DRAFT") {
      return {
        ok: false,
        code: "CONFLICT",
        message:
          "Emite la factura (con su N° de factura y control) antes de registrar cobros.",
      }
    }
    if (factura.status === "CANCELLED" || factura.status === "REFUNDED") {
      return {
        ok: false,
        code: "CONFLICT",
        message: "La factura está anulada o reembolsada: no admite nuevos cobros.",
      }
    }

    const tasa = Number(factura.bcv_rate_used)
    const desglose = desglosarCobro({
      metodo: datos.method,
      montoUSD: datos.amountUSD ?? undefined,
      montoVES: datos.amountVES ?? undefined,
      tasa,
    })

    if (desglose.baseUSD <= 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "El monto cobrado debe ser mayor que cero.",
      }
    }

    const verificado = datos.verificar
    const ahora = new Date().toISOString()

    const { data: pago, error: errorPago } = await supabase
      .from("payments")
      .insert({
        invoice_id: factura.id,
        tenant_id: tenantId,
        sede_id: factura.sede_id,
        method: datos.method,
        amount_usd: desglose.baseUSD,
        amount_ves: desglose.baseVES,
        reference_number: datos.referenceNumber,
        applies_igtf: desglose.aplicaIgtf,
        igtf_amount: desglose.igtfUSD,
        igtf_amount_ves: desglose.igtfVES,
        status: verificado ? "VERIFIED" : "PENDING_VERIFICATION",
        notes: datos.notes,
        verified_by: verificado ? usuarioId : null,
        verified_at: verificado ? ahora : null,
        created_by: usuarioId,
      })
      .select("*")
      .maybeSingle()

    if (errorPago) {
      const info = interpretarErrorFacturacion(errorPago)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!pago) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "El cobro no se guardó: tu usuario no tiene permisos de caja en esta clínica.",
      }
    }

    // Recálculo del estado de cobro con todos los pagos de la factura.
    const { data: pagosFactura } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", factura.id)

    const pagos = ((pagosFactura ?? []) as Payment[]).map(aPagoDTO)
    const estado = recalcularEstadoCobro(
      {
        subtotalUSD: Number(factura.subtotal_usd),
        vatUSD: Number(factura.vat_amount_usd),
        totalUSD: Number(factura.total_usd),
      },
      pagos
    )

    const nuevoEstado: InvoiceStatus =
      estado.paymentStatus === "PAID" && factura.status === "ISSUED"
        ? "PAID"
        : factura.status

    const { error: errorUpdate } = await supabase
      .from("invoices")
      .update({
        igtf_amount_usd: estado.igtfUSD,
        igtf_amount_ves: aVes(estado.igtfUSD, tasa),
        total_usd: estado.totalUSD,
        total_ves: aVes(estado.totalUSD, tasa),
        payment_status: estado.paymentStatus,
        status: nuevoEstado,
      })
      .eq("id", factura.id)

    if (errorUpdate) {
      const info = interpretarErrorFacturacion(errorUpdate)
      return { ok: false, code: info.code, message: info.message }
    }

    const facturaActualizada = await obtenerFactura(supabase, tenantId, factura.id)
    if (!facturaActualizada.ok) return facturaActualizada

    return {
      ok: true,
      data: {
        pago: aPagoDTO(pago as Payment),
        factura: facturaActualizada.data,
        desglose,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al registrar el cobro.",
    }
  }
}

/** API pública del cobro: valida la entrada y delega en la versión interna. */
export async function registrarPago(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  invoiceId: string,
  entrada: unknown
): Promise<AdminModuleResult<RespuestaCobro>> {
  const valido = registrarPagoSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  return registrarPagoValidado(supabase, tenantId, usuarioId, invoiceId, valido.data)
}

/* ------------------------------------------------------------------ */
/* Anulación y notas de ajuste fiscal                                 */
/* ------------------------------------------------------------------ */

/**
 * Emite una nota de ajuste vinculada a la factura:
 *  - `CREDITO` (por defecto): anula la factura (o la marca REFUNDED si se
 *    reembolsa el dinero) y rechaza los cobros pendientes de verificación.
 *  - `DEBITO`: registra un cargo adicional e incrementa el total a pagar.
 *
 * Ambas llevan numeración y N° de control propios.
 */
export async function anularFactura(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  invoiceId: string,
  entrada: unknown
): Promise<AdminModuleResult<RespuestaAnulacion>> {
  const valido = anularFacturaSchema.safeParse(entrada)
  if (!valido.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: valido.error.message,
      issues: valido.error.issues,
    }
  }
  const datos = valido.data

  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (error) {
      const info = interpretarErrorFacturacion(error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "La factura no existe en esta clínica.",
      }
    }

    const factura = data as Invoice
    if (factura.status === "CANCELLED" || factura.status === "REFUNDED") {
      return {
        ok: false,
        code: "CONFLICT",
        message: `La factura ${factura.invoice_number ?? ""} ya fue anulada o reembolsada.`,
      }
    }

    const tasa = Number(factura.bcv_rate_used)
    const montoUSD =
      datos.montoUSD ??
      (datos.tipo === "DEBITO" ? 0 : redondear2(Number(factura.total_usd)))

    if (datos.tipo === "DEBITO" && montoUSD <= 0) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "Indica el monto de la nota de débito.",
      }
    }

    const amountVES = aVes(montoUSD, tasa)
    const docType: FiscalDocType =
      datos.tipo === "CREDITO" ? "CREDIT_NOTE" : "DEBIT_NOTE"

    const numeracion = await siguienteNumeracion(
      supabase,
      tenantId,
      factura.sede_id,
      docType
    )
    if (!numeracion.ok) return numeracion

    const { invoiceNumber, controlNumber } = numeracion.data
    return emitirNota(
      supabase,
      tenantId,
      usuarioId,
      factura,
      datos,
      { invoiceNumber, controlNumber, montoUSD, amountVES, tasa }
    )
  } catch (cause) {
    return {
      ok: false,
      code: "SERVER_ERROR",
      message:
        cause instanceof Error
          ? cause.message
          : "Error inesperado al anular la factura.",
    }
  }
}

/** Datos ya resueltos para insertar la nota (numeración, montos y tasa). */
type NotaResuelta = {
  invoiceNumber: string | null
  controlNumber: string | null
  montoUSD: number
  amountVES: number
  tasa: number
}

/**
 * Inserta la nota (crédito o débito) y aplica sus efectos sobre la factura.
 * Se separa de `anularFactura` para mantener cada función con una sola
 * responsabilidad y facilitar las pruebas del flujo fiscal.
 */
async function emitirNota(
  supabase: Client,
  tenantId: string,
  usuarioId: string | null,
  factura: Invoice,
  datos: AnularFacturaInput,
  resuelto: NotaResuelta
): Promise<AdminModuleResult<RespuestaAnulacion>> {
  const { invoiceNumber, controlNumber, montoUSD, amountVES, tasa } = resuelto

  if (datos.tipo === "DEBITO") {
    const insert = await supabase
      .from("debit_notes")
      .insert({
        tenant_id: tenantId,
        invoice_id: factura.id,
        note_number: invoiceNumber,
        control_number: controlNumber,
        amount_usd: montoUSD,
        amount_ves: amountVES,
        motivo: datos.motivo,
        issued_by: usuarioId,
      })
      .select("*")
      .maybeSingle()

    if (insert.error) {
      const info = interpretarErrorFacturacion(insert.error)
      return { ok: false, code: info.code, message: info.message }
    }
    if (!insert.data) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message:
          "La nota de débito no se guardó: tu usuario no tiene permisos sobre esta factura.",
      }
    }

    // El cargo adicional incrementa el total a pagar de la factura.
    const nuevoTotal = redondear2(Number(factura.total_usd) + montoUSD)
    const { data: pagosFactura } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", factura.id)

    const pagado = redondear2(
      ((pagosFactura ?? []) as Payment[])
        .map(aPagoDTO)
        .filter((pago) => pago.status === "VERIFIED")
        .reduce((total, pago) => total + pago.amountUSD + pago.igtfAmountUSD, 0)
    )
    const paymentStatus: InvoicePaymentStatus =
      pagado <= 0 ? "PENDING" : pagado + 0.01 >= nuevoTotal ? "PAID" : "PARTIAL"

    const actualizada = await supabase
      .from("invoices")
      .update({
        total_usd: nuevoTotal,
        total_ves: aVes(nuevoTotal, tasa),
        payment_status: paymentStatus,
        status:
          paymentStatus === "PAID"
            ? "PAID"
            : factura.status === "PAID"
              ? "ISSUED"
              : factura.status,
      })
      .eq("id", factura.id)

    if (actualizada.error) {
      const info = interpretarErrorFacturacion(actualizada.error)
      return { ok: false, code: info.code, message: info.message }
    }

    const facturaFinal = await obtenerFactura(supabase, tenantId, factura.id)
    if (!facturaFinal.ok) return facturaFinal

    return {
      ok: true,
      data: {
        nota: aNotaAjusteDTO(insert.data as FilaNota, "DEBITO"),
        factura: facturaFinal.data,
      },
    }
  }

  // Nota de crédito: anulación (o reembolso) de la factura.
  const insert = await supabase
    .from("credit_notes")
    .insert({
      tenant_id: tenantId,
      invoice_id: factura.id,
      note_number: invoiceNumber,
      control_number: controlNumber,
      amount_usd: montoUSD,
      amount_ves: amountVES,
      motivo: datos.motivo,
      reembolsada: datos.reembolsar,
      issued_by: usuarioId,
    })
    .select("*")
    .maybeSingle()

  if (insert.error) {
    const info = interpretarErrorFacturacion(insert.error)
    return { ok: false, code: info.code, message: info.message }
  }
  if (!insert.data) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        "La nota de crédito no se guardó: tu usuario no tiene permisos sobre esta factura.",
    }
  }

  // Los cobros sin verificar dejan de aplicar tras la anulación.
  await supabase
    .from("payments")
    .update({
      status: "REJECTED",
      notes: `Factura anulada con nota de crédito ${invoiceNumber ?? ""}`.trim(),
    })
    .eq("invoice_id", factura.id)
    .eq("status", "PENDING_VERIFICATION")

  const actualizada = await supabase
    .from("invoices")
    .update({
      status: datos.reembolsar ? "REFUNDED" : "CANCELLED",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", factura.id)

  if (actualizada.error) {
    const info = interpretarErrorFacturacion(actualizada.error)
    return { ok: false, code: info.code, message: info.message }
  }

  const facturaFinal = await obtenerFactura(supabase, tenantId, factura.id)
  if (!facturaFinal.ok) return facturaFinal

  return {
    ok: true,
    data: {
      nota: aNotaAjusteDTO(insert.data as FilaNota, "CREDITO"),
      factura: facturaFinal.data,
    },
  }
}
