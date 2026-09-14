"use client"

/**
 * MEDISYS · Honorarios médicos (Módulo 3)
 * ---------------------------------------
 * Calcula y gestiona la liquidación de un especialista:
 *   1. Se elige el médico y el período; el motor extrae sus líneas de las
 *      facturas **cobradas** y aplica el honorario pactado en el catálogo.
 *   2. Se revisa el detalle (bruto, comisión de la clínica y neto a pagar).
 *   3. Se genera la liquidación, se aprueba y se marca como pagada con su
 *      referencia.
 */
import { useMemo, useState } from "react"
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Receipt,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react"

import type {
  LiquidacionDTO,
  LiquidacionPreview,
  MedicoOpcion,
} from "@/types/accounting"
import {
  ETIQUETA_ESTADO_LIQUIDACION,
  TONO_ESTADO_LIQUIDACION,
} from "@/lib/accounting-ve"
import type { TonoEstado } from "@/lib/billing-ve"
import {
  apiActualizarLiquidacion,
  apiGenerarLiquidacion,
  apiPreviewLiquidacion,
} from "@/lib/api-contabilidad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fechaCortaVE, rangoDelMes } from "@/lib/accounting-ve"
import { mesActualVenezuela } from "@/lib/accounting-ve"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

const CLASE_TONO: Record<TonoEstado, string> = {
  muted: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
}

type Toast = { tipo: "ok" | "error"; mensaje: string } | null

export function HonorariosMedicos({
  clinicSlug,
  medicos,
  liquidacionesIniciales,
  puedeEditar,
}: {
  clinicSlug: string
  medicos: MedicoOpcion[]
  liquidacionesIniciales: LiquidacionDTO[]
  puedeEditar: boolean
}) {
  const mes = useMemo(() => mesActualVenezuela(), [])
  const [doctorId, setDoctorId] = useState("")
  const [desde, setDesde] = useState(rangoDelMes(mes.anio, mes.mes).desde)
  const [hasta, setHasta] = useState(rangoDelMes(mes.anio, mes.mes).hasta)
  const [preview, setPreview] = useState<LiquidacionPreview | null>(null)
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionDTO[]>(
    liquidacionesIniciales
  )
  const [referencias, setReferencias] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  async function calcular() {
    if (!doctorId) {
      setToast({ tipo: "error", mensaje: "Selecciona el especialista." })
      return
    }
    setOcupado("calcular")
    setToast(null)
    const respuesta = await apiPreviewLiquidacion(clinicSlug, {
      doctorId,
      desde,
      hasta,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }
    setPreview(respuesta.data)
    if (respuesta.data.totalServicesCount === 0) {
      setToast({
        tipo: "error",
        mensaje:
          "No hay servicios cobrados para ese especialista en el período.",
      })
    }
  }

  async function generar(aprobar: boolean) {
    if (!doctorId) return
    setOcupado("generar")
    setToast(null)
    const respuesta = await apiGenerarLiquidacion(clinicSlug, {
      doctorId,
      periodStart: desde,
      periodEnd: hasta,
      bcvRate: null,
      aprobar,
      notes: null,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setLiquidaciones((previo) => [
      respuesta.data,
      ...previo.filter((item) => item.id !== respuesta.data.id),
    ])
    setToast({
      tipo: "ok",
      mensaje: `Liquidación de ${respuesta.data.doctorNombre} por ${formatUSD(
        respuesta.data.netPayableUSD
      )} generada${aprobar ? " y aprobada" : ""}.`,
    })
  }

  async function cambiarEstado(
    liquidacion: LiquidacionDTO,
    accion: "aprobar" | "pagar"
  ) {
    setOcupado(liquidacion.id)
    setToast(null)
    const respuesta = await apiActualizarLiquidacion(
      clinicSlug,
      liquidacion.id,
      {
        accion,
        paymentReference: referencias[liquidacion.id] ?? null,
        notes: null,
      }
    )
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setLiquidaciones((previo) =>
      previo.map((item) => (item.id === respuesta.data.id ? respuesta.data : item))
    )
    setToast({
      tipo: "ok",
      mensaje:
        accion === "aprobar"
          ? "Liquidación aprobada. Ya puede pagarse."
          : `Liquidación marcada como pagada (${respuesta.data.paymentReference ?? ""}).`,
    })
  }

  const totales = useMemo(() => {
    const pendientes = liquidaciones.filter((item) => item.status === "PENDING")
    const aprobadas = liquidaciones.filter((item) => item.status === "APPROVED")
    const pagadas = liquidaciones.filter((item) => item.status === "PAID")
    return {
      pendientes: pendientes.reduce((t, item) => t + item.netPayableUSD, 0),
      aprobadas: aprobadas.reduce((t, item) => t + item.netPayableUSD, 0),
      pagadas: pagadas.reduce((t, item) => t + item.netPayableUSD, 0),
      cantidad: liquidaciones.length,
    }
  }, [liquidaciones])

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato titulo="Pendientes de aprobar" usd={totales.pendientes} />
        <Dato titulo="Aprobadas por pagar" usd={totales.aprobadas} />
        <Dato titulo="Pagadas en el período" usd={totales.pagadas} />
        <Dato titulo="Liquidaciones" usd={0} texto={`${totales.cantidad} registros`} />
      </section>

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
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          )}
          {toast.mensaje}
        </p>
      )}

      {/* Cálculo del período */}
      {puedeEditar && (
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
          <div className="flex min-w-56 flex-col gap-1.5">
            <Label className="text-xs font-medium">Especialista</Label>
            <select
              value={doctorId}
              onChange={(evento) => {
                setDoctorId(evento.target.value)
                setPreview(null)
              }}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Selecciona un especialista…</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} · {medico.especialidad}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(evento) => setDesde(evento.target.value || desde)}
              className="h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(evento) => setHasta(evento.target.value || hasta)}
              className="h-10 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void calcular()}
            disabled={ocupado !== null}
            className="h-10 gap-2 rounded-xl px-4"
          >
            {ocupado === "calcular" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" aria-hidden="true" />
            )}
            Calcular honorarios
          </Button>
        </section>
      )}

      {/* Vista previa del cálculo */}
      {preview && (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <BadgeDollarSign className="size-4 text-primary" aria-hidden="true" />
              {preview.doctorNombre || "Especialista"}
              <span className="text-xs font-normal text-muted-foreground">
                {fechaCortaVE(preview.periodStart)} al{" "}
                {fechaCortaVE(preview.periodEnd)}
              </span>
            </h3>
            <span className="text-xs text-muted-foreground">
              {preview.totalServicesCount} servicios ·{" "}
              {preview.facturasConsideradas} facturas cobradas
            </span>
          </header>

          <div className="grid gap-3 sm:grid-cols-4">
            <Dato titulo="Bruto facturado" usd={preview.grossAmountUSD} />
            <Dato titulo="Comisión de la clínica" usd={preview.commissionDeductedUSD} />
            <Dato titulo="Neto a pagar" usd={preview.netPayableUSD} destacado />
            <Dato
              titulo="Neto en bolívares"
              usd={0}
              texto={formatBs(preview.netPayableVES)}
            />
          </div>

          {preview.detalle.length > 0 && (
            <ul className="flex max-h-56 flex-col divide-y overflow-y-auto rounded-xl border text-sm">
              {preview.detalle.map((linea, indice) => (
                <li
                  key={`${linea.invoiceId}-${indice}`}
                  className="flex flex-wrap items-center gap-2 p-2"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {linea.description}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {linea.invoiceNumber ?? "sin N°"} ·{" "}
                      {fechaCortaVE(linea.fecha)} · {linea.quantity} u.
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    bruto {formatUSD(linea.grossUSD)} · comisión{" "}
                    {formatUSD(linea.commissionUSD)}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatUSD(linea.netUSD)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {puedeEditar && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void generar(false)}
                disabled={ocupado !== null || preview.netPayableUSD <= 0}
                className="h-10 gap-2 rounded-xl px-4"
              >
                {ocupado === "generar" && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                Generar liquidación
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void generar(true)}
                disabled={ocupado !== null || preview.netPayableUSD <= 0}
                className="h-10 gap-2 rounded-xl px-4"
              >
                <ThumbsUp className="size-4" aria-hidden="true" />
                Generar y aprobar
              </Button>
              <span className="text-xs text-muted-foreground">
                Solo se liquidan los servicios de facturas cobradas.
              </span>
            </div>
          )}
        </section>
      )}

      {/* Historial de liquidaciones */}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CircleDollarSign className="size-3.5" aria-hidden="true" />
          Liquidaciones registradas ({liquidaciones.length})
        </h3>

        {liquidaciones.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay liquidaciones. Calcula el período de un especialista y
            genera la primera.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {liquidaciones.map((liquidacion) => (
              <li
                key={liquidacion.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 text-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {liquidacion.doctorNombre}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        CLASE_TONO[TONO_ESTADO_LIQUIDACION[liquidacion.status]]
                      )}
                    >
                      {ETIQUETA_ESTADO_LIQUIDACION[liquidacion.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fechaCortaVE(liquidacion.periodStart)} al{" "}
                      {fechaCortaVE(liquidacion.periodEnd)}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {liquidacion.totalServicesCount} servicios · bruto{" "}
                    {formatUSD(liquidacion.grossAmountUSD)} · comisión{" "}
                    {formatUSD(liquidacion.commissionDeductedUSD)}
                    {liquidacion.paymentReference
                      ? ` · ref. ${liquidacion.paymentReference}`
                      : ""}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold tabular-nums">
                    {formatUSD(liquidacion.netPayableUSD)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBs(liquidacion.netPayableVES)}
                  </span>
                </div>

                {puedeEditar && liquidacion.status !== "PAID" && (
                  <div className="flex shrink-0 items-center gap-2">
                    {liquidacion.status === "PENDING" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void cambiarEstado(liquidacion, "aprobar")}
                        disabled={ocupado === liquidacion.id}
                        className="h-9 gap-2 rounded-xl px-3 text-sm"
                      >
                        {ocupado === liquidacion.id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="size-4" aria-hidden="true" />
                        )}
                        Aprobar
                      </Button>
                    )}
                    <Input
                      value={referencias[liquidacion.id] ?? ""}
                      onChange={(evento) =>
                        setReferencias((previo) => ({
                          ...previo,
                          [liquidacion.id]: evento.target.value,
                        }))
                      }
                      placeholder="Referencia de pago"
                      className="h-9 w-40 text-sm"
                      aria-label={`Referencia de pago de ${liquidacion.doctorNombre}`}
                    />
                    <Button
                      type="button"
                      onClick={() => void cambiarEstado(liquidacion, "pagar")}
                      disabled={ocupado === liquidacion.id}
                      className="h-9 gap-2 rounded-xl px-3 text-sm"
                    >
                      Marcar pagada
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Dato({
  titulo,
  usd,
  texto,
  destacado,
}: {
  titulo: string
  usd: number
  texto?: string
  destacado?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-2xl border bg-card p-4",
        destacado && "border-primary/40 bg-primary/5"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-lg font-bold tabular-nums">
        {texto ?? formatUSD(usd)}
      </span>
    </div>
  )
}
