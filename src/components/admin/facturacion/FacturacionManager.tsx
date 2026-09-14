"use client"

/**
 * MEDISYS · Facturación y cobros (Módulo 2)
 * ------------------------------------------
 * Contenedor con dos vistas:
 *   1. «Emitir factura» → cierre de consulta (paciente + servicios + cobro).
 *   2. «Historial» → KPIs del período, filtros y listado con detalle.
 *
 * Los datos llegan hidratados desde el servidor y se refrescan contra
 * `/api/admin/invoices` (misma fuente que las integraciones externas).
 */
import { useMemo, useState } from "react"
import {
  FilePlus2,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react"

import type { SedeDTO, ServicioMedicoDTO } from "@/types/admin"
import type { FacturaDTO } from "@/types/billing"
import type { InvoiceStatus } from "@/types/database"
import type { PacienteFacturable } from "@/lib/admin/pacientes"
import {
  ETIQUETA_ESTADO_COBRO,
  ETIQUETA_ESTADO_FACTURA,
  TONO_ESTADO_COBRO,
  TONO_ESTADO_FACTURA,
  resumenFacturacion,
  type TonoEstado,
} from "@/lib/billing-ve"
import { apiListarFacturas } from "@/lib/api-facturacion"
import { EmisionFactura } from "@/components/admin/facturacion/EmisionFactura"
import { DetalleFactura } from "@/components/admin/facturacion/DetalleFactura"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

const CLASE_TONO: Record<TonoEstado, string> = {
  muted: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
}

const ESTADOS: readonly (InvoiceStatus | "TODAS")[] = [
  "TODAS",
  "DRAFT",
  "ISSUED",
  "PAID",
  "CANCELLED",
  "REFUNDED",
]

type Tab = "emitir" | "historial"

export function FacturacionManager({
  clinicSlug,
  facturasIniciales,
  pacientes,
  servicios,
  sedes,
  tasaBCV,
  permisos,
  sedeIdsAsignadas,
}: {
  clinicSlug: string
  facturasIniciales: FacturaDTO[]
  pacientes: PacienteFacturable[]
  servicios: ServicioMedicoDTO[]
  sedes: SedeDTO[]
  tasaBCV: number
  permisos: { emitir: boolean; cobrar: boolean; anular: boolean }
  sedeIdsAsignadas: string[]
}) {
  const [tab, setTab] = useState<Tab>("emitir")
  const [facturas, setFacturas] = useState<FacturaDTO[]>(facturasIniciales)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [status, setStatus] = useState<InvoiceStatus | "TODAS">("TODAS")
  const [sedeId, setSedeId] = useState("")
  const [q, setQ] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resumen = useMemo(() => resumenFacturacion(facturas), [facturas])

  /** Factura abierta en el panel de detalle (derivada de la lista). */
  const seleccionada = useMemo(
    () =>
      seleccionadaId
        ? facturas.find((factura) => factura.id === seleccionadaId) ?? null
        : null,
    [facturas, seleccionadaId]
  )

  const filtradas = useMemo(() => {
    const termino = q.trim().toLowerCase()
    if (!termino) return facturas
    return facturas.filter((factura) =>
      [
        factura.invoiceNumber,
        factura.controlNumber,
        factura.fiscalProfile.razonSocial,
        factura.patientNombre,
      ].some((campo) => campo?.toLowerCase().includes(termino))
    )
  }, [facturas, q])

  /** Consulta el listado al servidor con los filtros activos. */
  async function refrescar() {
    setCargando(true)
    setError(null)
    const respuesta = await apiListarFacturas(clinicSlug, {
      desde: desde || null,
      hasta: hasta || null,
      sedeId: sedeId || null,
      status,
      q: q.trim() || null,
      limite: 200,
    })
    setCargando(false)

    if (!respuesta.ok) {
      setError(respuesta.message)
      return
    }
    setFacturas(respuesta.data.facturas)
  }

  /** Inserta/actualiza una factura en la lista local (sin recargar). */
  function aplicar(factura: FacturaDTO) {
    setFacturas((previo) => [
      factura,
      ...previo.filter((item) => item.id !== factura.id),
    ])
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Pestañas */}
      <div className="flex gap-2 rounded-xl border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("emitir")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "emitir"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <FilePlus2 className="size-4" aria-hidden="true" />
          Emitir factura
        </button>
        <button
          type="button"
          onClick={() => setTab("historial")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "historial"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <History className="size-4" aria-hidden="true" />
          Historial ({facturas.length})
        </button>
      </div>

      {seleccionada ? (
        <DetalleFactura
          clinicSlug={clinicSlug}
          factura={seleccionada}
          puedeCobrar={permisos.cobrar}
          puedeAnular={permisos.anular}
          onActualizada={aplicar}
          onCerrar={() => setSeleccionadaId(null)}
        />
      ) : tab === "emitir" ? (
        <EmisionFactura
          clinicSlug={clinicSlug}
          pacientes={pacientes}
          servicios={servicios}
          sedes={sedes}
          tasaBCV={tasaBCV}
          sedeIdsAsignadas={sedeIdsAsignadas}
          puedeEmitir={permisos.emitir}
          onEmitida={aplicar}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta
              titulo="Facturado"
              valor={formatUSD(resumen.totalUSD)}
              detalle={formatBs(resumen.totalVES)}
            />
            <Tarjeta
              titulo="Cobrado"
              valor={formatUSD(resumen.cobradoUSD)}
              detalle={`${resumen.pagadas} pagadas`}
            />
            <Tarjeta
              titulo="Por cobrar"
              valor={formatUSD(resumen.porCobrarUSD)}
              detalle={`${resumen.emitidas} emitidas · ${resumen.borradores} borradores`}
            />
            <Tarjeta
              titulo="IVA / IGTF"
              valor={formatUSD(resumen.ivaUSD)}
              detalle={`IGTF ${formatUSD(resumen.igtfUSD)} · ${resumen.anuladas} anuladas`}
            />
          </section>

          {/* Filtros */}
          <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(evento) => setDesde(evento.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(evento) => setHasta(evento.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Estado</Label>
              <select
                value={status}
                onChange={(evento) =>
                  setStatus(evento.target.value as InvoiceStatus | "TODAS")
                }
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {ESTADOS.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor === "TODAS"
                      ? "Todos"
                      : ETIQUETA_ESTADO_FACTURA[valor as InvoiceStatus]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Sede</Label>
              <select
                value={sedeId}
                onChange={(evento) => setSedeId(evento.target.value)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Todas</option>
                {sedes.map((sede) => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative min-w-52 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={q}
                onChange={(evento) => setQ(evento.target.value)}
                placeholder="N° de factura, control o cliente…"
                className="h-10 pl-9 text-sm"
                aria-label="Buscar factura"
              />
            </div>
            <Button
              type="button"
              onClick={() => void refrescar()}
              disabled={cargando}
              className="h-10 gap-2 rounded-xl px-4"
            >
              {cargando ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Filtrar
            </Button>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {error}
            </p>
          )}

          {/* Listado */}
          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
              <History className="size-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">Sin facturas en el período</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Emite la primera factura desde la pestaña «Emitir factura» o
                amplía el rango de fechas.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtradas.map((factura) => (
                <li
                  key={factura.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {factura.invoiceNumber ?? "Borrador"}
                      </span>
                      {factura.controlNumber && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {factura.controlNumber}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          CLASE_TONO[TONO_ESTADO_FACTURA[factura.status]]
                        )}
                      >
                        {ETIQUETA_ESTADO_FACTURA[factura.status]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          CLASE_TONO[TONO_ESTADO_COBRO[factura.paymentStatus]]
                        )}
                      >
                        {ETIQUETA_ESTADO_COBRO[factura.paymentStatus]}
                      </span>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {factura.fiscalProfile.razonSocial}
                      {factura.sedeNombre ? ` · ${factura.sedeNombre}` : ""} ·{" "}
                      {new Date(factura.createdAt).toLocaleDateString("es-VE", {
                        timeZone: "America/Caracas",
                      })}
                    </span>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-semibold tabular-nums">
                      {formatUSD(factura.totalUSD)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatBs(factura.totalVES)}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSeleccionadaId(factura.id)}
                    className="h-9 shrink-0 rounded-xl px-3 text-sm"
                  >
                    Ver detalle
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function Tarjeta({
  titulo,
  valor,
  detalle,
}: {
  titulo: string
  valor: string
  detalle: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-xl font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </div>
  )
}
