"use client"

/**
 * MEDISYS · Emisión de factura / cierre de consulta (Módulo 2)
 * -------------------------------------------------------------
 * Flujo:
 *   1. Selecciona paciente (auto-completa sus datos fiscales) o cliente invitado.
 *   2. Agrega servicios del catálogo (o conceptos libres) y ajusta cantidades.
 *   3. Revisa el doble despliegue USD/VES con IVA y la tasa BCV aplicada.
 *   4. Elige el método de cobro: si es en divisas se muestra el IGTF del 3%.
 *   5. Guarda como borrador o emite (con N° de factura y control) y cobra.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Calculator,
  FileText,
  LoaderCircle,
  Plus,
  Receipt,
  TriangleAlert,
  Trash2,
  UserRound,
} from "lucide-react"

import type { SedeDTO, ServicioMedicoDTO } from "@/types/admin"
import type { FacturaDTO } from "@/types/billing"
import type { PaymentMethod, TipoDocumentoFiscal } from "@/types/database"
import type { PacienteFacturable } from "@/lib/admin/pacientes"
import { TIPOS_DOCUMENTO } from "@/lib/fiscal-ve"
import {
  METODOS_COBRO,
  calcularLineaFactura,
  calcularTotalesFactura,
  desglosarCobro,
  infoMetodoCobro,
  recalcularEstadoCobro,
} from "@/lib/billing-ve"
import { emitirFacturaSchema } from "@/lib/validations/billing"
import { apiCrearFactura } from "@/lib/api-facturacion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

type LineaBorrador = {
  key: string
  serviceId: string | null
  description: string
  quantity: number
  unitPriceUSD: number
  taxable: boolean
}

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

function nuevaClave(): string {
  return `linea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function EmisionFactura({
  clinicSlug,
  pacientes,
  servicios,
  sedes,
  tasaBCV,
  sedeIdsAsignadas,
  puedeEmitir,
  onEmitida,
}: {
  clinicSlug: string
  pacientes: PacienteFacturable[]
  servicios: ServicioMedicoDTO[]
  sedes: SedeDTO[]
  tasaBCV: number
  sedeIdsAsignadas: string[]
  puedeEmitir: boolean
  onEmitida: (factura: FacturaDTO) => void
}) {
  const sedeInicial = useMemo(() => {
    const asignadas = sedes.filter((sede) =>
      sedeIdsAsignadas.includes(sede.id)
    )
    const principal = asignadas.find((sede) => sede.esPrincipal)
    return principal?.id ?? asignadas[0]?.id ?? sedes[0]?.id ?? null
  }, [sedes, sedeIdsAsignadas])

  const [sedeId, setSedeId] = useState<string | null>(sedeInicial)
  const [pacienteId, setPacienteId] = useState<string>("")
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoFiscal>("V")
  const [documentoIdentidad, setDocumentoIdentidad] = useState("")
  const [razonSocial, setRazonSocial] = useState("")
  const [direccionFiscal, setDireccionFiscal] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [lineas, setLineas] = useState<LineaBorrador[]>([])
  const [tasa, setTasa] = useState(String(tasaBCV))
  const [metodo, setMetodo] = useState<PaymentMethod>("PAGO_MOVIL")
  const [referencia, setReferencia] = useState("")
  const [cobrarAhora, setCobrarAhora] = useState(true)
  const [notas, setNotas] = useState("")
  const [guardando, setGuardando] = useState<"borrador" | "emitir" | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  const infoMetodo = infoMetodoCobro(metodo)
  const serviciosActivos = useMemo(
    () => servicios.filter((servicio) => servicio.activo),
    [servicios]
  )

  /** Líneas ya calculadas con IVA y honorario (vista previa fiel al backend). */
  const lineasCalculadas = useMemo(() => {
    const tasaNumero = Number(tasa) || 0
    return lineas.map((linea) => {
      const servicio = linea.serviceId
        ? servicios.find((item) => item.id === linea.serviceId) ?? null
        : null
      return {
        ...linea,
        calculada: calcularLineaFactura(
          {
            description: linea.description,
            quantity: linea.quantity,
            unitPriceUSD: linea.unitPriceUSD,
            taxable: linea.taxable || servicio?.taxable === true,
            serviceId: servicio?.id ?? null,
            doctorId: servicio?.doctorId ?? null,
            doctorCommissionAmount: servicio
              ? calcularComision(
                  linea.unitPriceUSD * linea.quantity,
                  servicio
                )
              : 0,
          },
          tasaNumero
        ),
      }
    })
  }, [lineas, servicios, tasa])

  const totales = useMemo(() => {
    const tasaNumero = Number(tasa) || 0
    return calcularTotalesFactura(
      lineasCalculadas.map((linea) => linea.calculada),
      { tasa: tasaNumero }
    )
  }, [lineasCalculadas, tasa])

  const cobroPreview = useMemo(() => {
    const tasaNumero = Number(tasa) || 0
    if (!cobrarAhora) return null
    return desglosarCobro({
      metodo,
      montoUSD: totales.totalUSD,
      tasa: tasaNumero,
    })
  }, [cobrarAhora, metodo, tasa, totales.totalUSD])

  const estadoCobroPreview = useMemo(
    () =>
      recalcularEstadoCobro(
        {
          subtotalUSD: totales.subtotalUSD,
          vatUSD: totales.vatUSD,
          totalUSD: totales.totalUSD,
        },
        cobroPreview
          ? [
              {
                amountUSD: cobroPreview.baseUSD,
                igtfAmountUSD: cobroPreview.igtfUSD,
                status: "VERIFIED" as const,
              },
            ]
          : []
      ),
    [cobroPreview, totales]
  )

  function seleccionarPaciente(valor: string) {
    setPacienteId(valor)
    const paciente = pacientes.find((item) => item.id === valor)
    if (!paciente) return
    setTipoDocumento(
      paciente.tipoDocumento ??
        (paciente.cedula?.toUpperCase().startsWith("E") ? "E" : "V")
    )
    setDocumentoIdentidad(paciente.documentoIdentidad ?? paciente.cedula ?? "")
    setRazonSocial(paciente.razonSocial ?? paciente.nombre)
    setDireccionFiscal(paciente.direccionFiscal ?? "")
    setEmail(paciente.email ?? "")
    setTelefono(paciente.telefono ?? "")
  }

  function agregarServicio(servicioId: string) {
    const servicio = servicios.find((item) => item.id === servicioId)
    if (!servicio) return
    setLineas((previo) => [
      ...previo,
      {
        key: nuevaClave(),
        serviceId: servicio.id,
        description: servicio.title,
        quantity: 1,
        unitPriceUSD: servicio.priceUSD,
        taxable: servicio.taxable,
      },
    ])
  }

  function agregarConceptoLibre() {
    setLineas((previo) => [
      ...previo,
      {
        key: nuevaClave(),
        serviceId: null,
        description: "",
        quantity: 1,
        unitPriceUSD: 0,
        taxable: false,
      },
    ])
  }

  function actualizarLinea(key: string, cambios: Partial<LineaBorrador>) {
    setLineas((previo) =>
      previo.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea))
    )
  }

  function quitarLinea(key: string) {
    setLineas((previo) => previo.filter((linea) => linea.key !== key))
  }

  async function guardar(emitir: boolean) {
    const payload = {
      sedeId,
      patientId: pacienteId || null,
      appointmentId: null,
      fiscalProfile: {
        tipoDocumento,
        documentoIdentidad,
        razonSocial,
        direccionFiscal,
        email: email || null,
        telefono: telefono || null,
        pacienteNombre: razonSocial || null,
      },
      items: lineasCalculadas.map((linea) => ({
        serviceId: linea.serviceId,
        description: linea.description,
        quantity: linea.quantity,
        unitPriceUSD: linea.unitPriceUSD,
        taxable: linea.calculada.taxable,
        doctorId: linea.calculada.doctorId,
      })),
      bcvRate: Number(tasa) || null,
      emitir,
      notas: notas || null,
      cobro:
        emitir && cobrarAhora
          ? {
              method: metodo,
              amountUSD: totales.totalUSD,
              amountVES: null,
              referenceNumber: referencia || null,
              notes: null,
              verificar: true,
            }
          : null,
    }

    const valido = emitirFacturaSchema.safeParse(payload)
    if (!valido.success) {
      setToast({
        tipo: "error",
        mensaje: `${valido.error.message} (${valido.error.issues
          .slice(0, 3)
          .map((issue) => issue.campo)
          .join(", ")})`,
      })
      return
    }

    setGuardando(emitir ? "emitir" : "borrador")
    const respuesta = await apiCrearFactura(clinicSlug, valido.data)
    setGuardando(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    onEmitida(respuesta.data)
    setToast({
      tipo: "ok",
      mensaje: emitir
        ? `Factura ${respuesta.data.invoiceNumber ?? ""} emitida${
            cobroPreview
              ? ` y cobrada (${formatUSD(cobroPreview.totalUSD)})`
              : "."
          }`
        : `Borrador guardado para ${respuesta.data.fiscalProfile.razonSocial}.`,
    })
    setLineas([])
    setNotas("")
    setReferencia("")
  }

  const puedeGuardar = puedeEmitir && lineas.length > 0 && guardando === null

  return (
    <section className="flex flex-col gap-5">
      {!puedeEmitir && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          Tu rol no puede emitir facturas: puedes consultar el historial.
        </p>
      )}

      {toast && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            toast.tipo === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {toast.mensaje}
        </p>
      )}

      {/* 1. Paciente y datos fiscales */}
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          Cliente / paciente
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El RIF o cédula, la razón social y la dirección fiscal son obligatorios
          para emitir (formas libres SENIAT).
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Paciente registrado</Label>
            <select
              value={pacienteId}
              onChange={(evento) => seleccionarPaciente(evento.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Cliente invitado (sin registro)</option>
              {pacientes.map((paciente) => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.nombre}
                  {paciente.cedula ? ` · ${paciente.cedula}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Tipo de documento *</Label>
            <select
              value={tipoDocumento}
              onChange={(evento) =>
                setTipoDocumento(evento.target.value as TipoDocumentoFiscal)
              }
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TIPOS_DOCUMENTO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              {tipoDocumento === "J" || tipoDocumento === "G"
                ? "RIF *"
                : tipoDocumento === "P"
                  ? "Pasaporte *"
                  : "Cédula *"}
            </Label>
            <Input
              value={documentoIdentidad}
              onChange={(evento) => setDocumentoIdentidad(evento.target.value)}
              placeholder={tipoDocumento === "J" ? "J-40123456-7" : "V-12345678"}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">
              Razón social / nombre a facturar *
            </Label>
            <Input
              value={razonSocial}
              onChange={(evento) => setRazonSocial(evento.target.value)}
              placeholder="IBEARTS, C.A."
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Dirección fiscal *</Label>
            <Input
              value={direccionFiscal}
              onChange={(evento) => setDireccionFiscal(evento.target.value)}
              placeholder="Av. Bolívar, Torre Médica, Piso 3, Caracas"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Correo</Label>
            <Input
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              type="email"
              placeholder="paciente@correo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Teléfono</Label>
            <Input
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
              inputMode="tel"
              placeholder="0414-1234567"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Sede</Label>
            <select
              value={sedeId ?? ""}
              onChange={(evento) => setSedeId(evento.target.value || null)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sin sede específica</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}
                  {sede.esPrincipal ? " (principal)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Servicios y conceptos */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Receipt className="size-4 text-primary" aria-hidden="true" />
            Servicios y honorarios
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(evento) => agregarServicio(evento.target.value)}
              className="h-10 min-w-56 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Agregar del catálogo…</option>
              {serviciosActivos.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.title} · {formatUSD(servicio.priceUSD)}
                  {servicio.taxable ? " · IVA" : " · exento"}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={agregarConceptoLibre}
              className="h-10 gap-2 rounded-xl"
            >
              <Plus className="size-4" aria-hidden="true" />
              Concepto libre
            </Button>
          </div>
        </div>

        {lineasCalculadas.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Agrega los servicios de la consulta para calcular IVA, honorarios y
            totales.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y rounded-xl border">
            {lineasCalculadas.map((linea) => (
              <li key={linea.key} className="flex flex-col gap-3 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_5rem_7rem_auto]">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Concepto
                    </Label>
                    <Input
                      value={linea.description}
                      onChange={(evento) =>
                        actualizarLinea(linea.key, {
                          description: evento.target.value,
                        })
                      }
                      placeholder="Consulta Cardiología General"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Cant.
                    </Label>
                    <Input
                      value={String(linea.quantity)}
                      onChange={(evento) =>
                        actualizarLinea(linea.key, {
                          quantity: Math.max(
                            1,
                            Math.trunc(Number(evento.target.value) || 1)
                          ),
                        })
                      }
                      inputMode="numeric"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Precio USD
                    </Label>
                    <Input
                      value={String(linea.unitPriceUSD)}
                      onChange={(evento) =>
                        actualizarLinea(linea.key, {
                          unitPriceUSD: Number(
                            evento.target.value
                              .replace(",", ".")
                              .replace(/[^\d.]/g, "")
                          ),
                        })
                      }
                      inputMode="decimal"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                      <input
                        type="checkbox"
                        checked={linea.calculada.taxable}
                        onChange={(evento) =>
                          actualizarLinea(linea.key, {
                            taxable: evento.target.checked,
                          })
                        }
                        className="size-4 rounded border-input"
                      />
                      IVA 16%
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar línea"
                      onClick={() => quitarLinea(linea.key)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Subtotal:{" "}
                    <strong className="text-foreground">
                      {formatUSD(linea.calculada.subtotalUSD)}
                    </strong>{" "}
                    · {formatBs(linea.calculada.subtotalVES)}
                  </span>
                  <span>
                    IVA: {formatUSD(linea.calculada.ivaUSD)} (
                    {Math.round(linea.calculada.alicuotaIva * 100)}%)
                  </span>
                  <span>
                    Honorario médico:{" "}
                    {formatUSD(linea.calculada.doctorCommissionAmount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 3. Tasa, totales y método de cobro */}
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Calculator className="size-4 text-primary" aria-hidden="true" />
          Tasa BCV, IVA e IGTF
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La factura se emite con el desglose en dólares y bolívares a la tasa
          oficial aplicada.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              Tasa BCV aplicada (Bs/USD)
            </Label>
            <Input
              value={tasa}
              onChange={(evento) => setTasa(evento.target.value)}
              inputMode="decimal"
              placeholder="36,50"
            />
            <span className="text-xs text-muted-foreground">
              Por defecto: tasa vigente del sistema ({tasaBCV} Bs/USD).
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Método de cobro</Label>
            <select
              value={metodo}
              onChange={(evento) =>
                setMetodo(evento.target.value as PaymentMethod)
              }
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {METODOS_COBRO.map((valor) => {
                const info = infoMetodoCobro(valor)
                return (
                  <option key={valor} value={valor}>
                    {info.label} · {info.moneda}
                    {info.aplicaIgtf ? " · IGTF 3%" : ""}
                  </option>
                )
              })}
            </select>
            <span className="text-xs text-muted-foreground">
              {infoMetodo.detalle}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Dato
            titulo="Subtotal"
            usd={totales.subtotalUSD}
            ves={totales.subtotalVES}
          />
          <Dato titulo="IVA (16%)" usd={totales.vatUSD} ves={totales.vatVES} />
          <Dato
            titulo={infoMetodo.aplicaIgtf ? "IGTF (3%)" : "IGTF (no aplica)"}
            usd={cobroPreview?.igtfUSD ?? 0}
            ves={cobroPreview?.igtfVES ?? 0}
          />
          <Dato
            titulo="Total a pagar"
            usd={cobroPreview?.totalUSD ?? totales.totalUSD}
            ves={cobroPreview?.totalVES ?? totales.totalVES}
            destacado
          />
        </div>
      </div>

      {/* 4. Cobro y acciones */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cobrarAhora}
              onChange={(evento) => setCobrarAhora(evento.target.checked)}
              className="size-4 rounded border-input"
            />
            Registrar el cobro al emitir (cierre de consulta)
          </label>

          {cobrarAhora && (
            <div className="flex flex-1 flex-col gap-1.5">
              <Label className="text-sm font-medium">
                Referencia {infoMetodo.requiereReferencia ? "*" : "(opcional)"}
              </Label>
              <Input
                value={referencia}
                onChange={(evento) =>
                  setReferencia(evento.target.value.toUpperCase())
                }
                placeholder="Últimos 4-6 dígitos"
                className="h-10 text-sm"
              />
            </div>
          )}
        </div>

        {cobroPreview && (
          <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Cobro previsto: {formatUSD(cobroPreview.baseUSD)} base
            {cobroPreview.igtfUSD > 0
              ? ` + ${formatUSD(cobroPreview.igtfUSD)} de IGTF`
              : " (sin IGTF)"}{" "}
            ={" "}
            <strong className="text-foreground">
              {formatUSD(cobroPreview.totalUSD)}
            </strong>{" "}
            ({formatBs(cobroPreview.totalVES)}). Queda como cobro verificado y la
            factura pasa a «{estadoCobroPreview.paymentStatus}».
          </p>
        )}

        <div className="mt-4 flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Nota interna</Label>
          <Input
            value={notas}
            onChange={(evento) => setNotas(evento.target.value)}
            placeholder="Observaciones de la factura (opcional)"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            type="button"
            onClick={() => void guardar(true)}
            disabled={!puedeGuardar}
            className="h-11 gap-2 rounded-xl px-5"
          >
            {guardando === "emitir" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
            Emitir factura
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void guardar(false)}
            disabled={!puedeGuardar}
            className="h-11 gap-2 rounded-xl px-5"
          >
            {guardando === "borrador" && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Guardar borrador
          </Button>
          <span className="text-xs text-muted-foreground">
            Emitir consume la numeración fiscal (N° de factura y control); el
            borrador no.
          </span>
        </div>
      </div>
    </section>
  )
}

/** Bloque de importe con doble despliegue USD/VES. */
function Dato({
  titulo,
  usd,
  ves,
  destacado,
}: {
  titulo: string
  usd: number
  ves: number
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-3",
        destacado && "border-primary/40 bg-primary/5"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-lg font-bold tabular-nums">{formatUSD(usd)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatBs(ves)}
      </span>
    </div>
  )
}

/** Honorario del especialista para una línea (porcentaje o monto fijo). */
function calcularComision(importe: number, servicio: ServicioMedicoDTO): number {
  if (servicio.doctorCommissionType === "FIXED") {
    return Math.min(servicio.doctorCommissionValue, importe)
  }
  return (importe * Math.min(servicio.doctorCommissionValue, 100)) / 100
}
