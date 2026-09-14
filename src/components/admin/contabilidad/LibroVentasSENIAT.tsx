"use client"

/**
 * MEDISYS · Libro de Ventas SENIAT (Módulo 3)
 * -------------------------------------------
 * Reporte oficial del mes: filas por operación (factura, notas, base, IVA y
 * IGTF) más el consolidado. Permite cambiar de período/sede, descargar el CSV
 * para Excel y imprimirlo tal cual (formato apaisado).
 */
import { useState } from "react"
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  RefreshCw,
} from "lucide-react"

import type { SedeDTO } from "@/types/admin"
import type {
  LibroVentasFila,
  LibroVentasReporte,
} from "@/types/accounting"
import { apiLibroVentas, urlLibroVentasCsv } from "@/lib/api-contabilidad"
import { COLUMNAS_LIBRO_VENTAS, fechaCortaVE } from "@/lib/accounting-ve"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatBs, formatUSD } from "@/lib/format"
import { cn } from "@/lib/utils"

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

export function LibroVentasSENIAT({
  clinicSlug,
  reporteInicial,
  sedes,
}: {
  clinicSlug: string
  reporteInicial: LibroVentasReporte
  sedes: SedeDTO[]
}) {
  const [anio, setAnio] = useState(String(reporteInicial.anio))
  const [mes, setMes] = useState(String(reporteInicial.mes))
  const [sedeId, setSedeId] = useState("")
  const [reporte, setReporte] = useState(reporteInicial)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resumen = reporte.resumen

  async function actualizar() {
    setCargando(true)
    setError(null)
    const respuesta = await apiLibroVentas(clinicSlug, {
      anio: Number(anio) || reporteInicial.anio,
      mes: Number(mes) || reporteInicial.mes,
      sedeId: sedeId || null,
    })
    setCargando(false)

    if (!respuesta.ok) {
      setError(respuesta.message)
      return
    }
    setReporte(respuesta.data)
  }

  const urlCsv = urlLibroVentasCsv(clinicSlug, {
    anio: Number(anio) || reporte.anio,
    mes: Number(mes) || reporte.mes,
    sedeId: sedeId || null,
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 print:hidden">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Año</Label>
          <Input
            value={anio}
            onChange={(evento) => setAnio(evento.target.value)}
            inputMode="numeric"
            className="h-10 w-24 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Mes</Label>
          <select
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {MESES.map((nombre, indice) => (
              <option key={nombre} value={String(indice + 1)}>
                {nombre}
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
            <option value="">Todas las sedes</option>
            {sedes.map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.nombre}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          onClick={() => void actualizar()}
          disabled={cargando}
          className="h-10 gap-2 rounded-xl px-4"
        >
          {cargando ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Generar libro
        </Button>

        <a
          href={urlCsv}
          download
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/60"
        >
          <Download className="size-4" aria-hidden="true" />
          Descargar CSV
        </a>

        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="h-10 gap-2 rounded-xl px-4"
        >
          <Printer className="size-4" aria-hidden="true" />
          Imprimir
        </Button>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 print:hidden"
        >
          {error}
        </p>
      )}

      {/* Encabezado del reporte */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary" aria-hidden="true" />
          <div className="flex flex-col">
            <h2 className="font-semibold">
              Libro de Ventas · {MESES[reporte.mes - 1] ?? ""} {reporte.anio}
            </h2>
            <span className="text-xs text-muted-foreground">
              Período {fechaCortaVE(reporte.desde)} al{" "}
              {fechaCortaVE(reporte.hasta)} · Tasa BCV de referencia:{" "}
              {formatBs(reporte.tasaReferencia)}/USD
            </span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          Generado el{" "}
          {new Date(reporte.generadoEn).toLocaleString("es-VE", {
            timeZone: "America/Caracas",
          })}
        </span>
      </header>

      {/* Resumen mensual */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          titulo="Total ventas incl. IVA"
          principal={formatUSD(resumen.totalConIvaUSD)}
          secundario={formatBs(resumen.totalConIvaVES)}
          destacado
        />
        <Dato
          titulo="Ventas exentas / no gravadas"
          principal={formatUSD(resumen.ventasExentasUSD)}
          secundario={formatBs(resumen.ventasExentasVES)}
        />
        <Dato
          titulo="Base imponible (16%)"
          principal={formatUSD(resumen.baseImponibleUSD)}
          secundario={`IVA ${formatUSD(resumen.ivaDebitadoUSD)}`}
        />
        <Dato
          titulo="IGTF percibido"
          principal={formatUSD(resumen.igtfPercibidoUSD)}
          secundario={formatBs(resumen.igtfPercibidoVES)}
        />
      </section>

      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {resumen.facturas} facturas vigentes · {resumen.anuladas} anuladas/
        reembolsadas · Notas de crédito {formatUSD(resumen.notaCreditoUSD)} ·
        Notas de débito {formatUSD(resumen.notaDebitoUSD)} · Total de tributos a
        enterar:{" "}
        <strong className="text-foreground">
          {formatUSD(resumen.totalTributosUSD)}
        </strong>{" "}
        ({formatBs(resumen.totalTributosVES)})
      </p>

      {/* Tabla oficial */}
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[1100px] border-collapse text-xs">
          <thead className="bg-muted/60 text-left">
            <tr>
              {COLUMNAS_LIBRO_VENTAS.map((columna) => (
                <th
                  key={columna}
                  className="whitespace-nowrap px-3 py-2 font-semibold"
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reporte.filas.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNAS_LIBRO_VENTAS.length}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay operaciones registradas en el período.
                </td>
              </tr>
            ) : (
              reporte.filas.map((fila, indice) => (
                <FilaLibro
                  key={`${fila.invoiceNumber ?? "s-n"}-${indice}`}
                  fila={fila}
                />
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted-foreground">
        Los montos en bolívares se calculan con la tasa BCV vigente al momento de
        cada factura. El IGTF se reporta aparte porque grava el medio de pago
        (divisas), no la venta. Reporte generado por Medisys para el archivo
        fiscal del contribuyente.
      </p>
    </div>
  )
}

/** Fila del libro; las operaciones anuladas se atenúan para auditoría. */
function FilaLibro({ fila }: { fila: LibroVentasFila }) {
  const esVigente = fila.tipoOperacion === "VENTA"

  return (
    <tr
      className={cn(
        "border-t align-top",
        !esVigente && "text-muted-foreground"
      )}
    >
      <td className="whitespace-nowrap px-3 py-2">{fechaCortaVE(fila.fecha)}</td>
      <td className="px-3 py-2">{fila.tipoDocumento}</td>
      <td className="whitespace-nowrap px-3 py-2">
        {fila.documentoIdentidad || "—"}
      </td>
      <td className="px-3 py-2">{fila.razonSocial || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2">
        {fila.invoiceNumber ?? "Borrador"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {fila.controlNumber ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {fila.notaCreditoNumber ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {fila.notaDebitoNumber ?? "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUSD(fila.totalConIvaUSD)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUSD(fila.ventasExentasUSD)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUSD(fila.baseImponibleUSD)}
      </td>
      <td className="px-3 py-2 text-right">
        {Math.round(fila.alicuota * 100)}%
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUSD(fila.ivaDebitadoUSD)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUSD(fila.igtfPercibidoUSD)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatBs(fila.totalConIvaVES)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatBs(fila.ivaDebitadoVES)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatBs(fila.igtfPercibidoVES)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium">
        {fila.tipoOperacion}
      </td>
    </tr>
  )
}

function Dato({
  titulo,
  principal,
  secundario,
  destacado,
}: {
  titulo: string
  principal: string
  secundario: string
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
      <span className="text-lg font-bold tabular-nums">{principal}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {secundario}
      </span>
    </div>
  )
}
