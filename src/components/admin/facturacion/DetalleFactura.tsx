"use client"

/**
 * MEDISYS · Detalle de factura (Módulo 2)
 * ----------------------------------------
 * Panel de una factura con:
 *   - Cabecera fiscal (N° de factura, N° de control, estados, sede).
 *   - Datos fiscales del cliente y detalle de líneas con IVA/honorarios.
 *   - Doble despliegue (USD/VES) con la tasa BCV aplicada.
 *   - Cobros registrados (con IGTF) y formulario para registrar uno nuevo.
 *   - Emisión de nota de crédito (anulación/reembolso) o débito (cargo extra).
 */
import { useEffect, useMemo, useState } from "react"
import {
  Ban,
  FileCheck2,
  LoaderCircle,
  PlusCircle,
  Receipt,
  UserRound,
  X,
} from "lucide-react"

import type { FacturaDTO } from "@/types/billing"
import type { PaymentMethod } from "@/types/database"
import {
  ETIQUETA_ESTADO_COBRO,
  ETIQUETA_ESTADO_FACTURA,
  ETIQUETA_ESTADO_PAGO,
  METODOS_COBRO,
  TONO_ESTADO_COBRO,
  TONO_ESTADO_FACTURA,
  TONO_ESTADO_PAGO,
  desglosarCobro,
  infoMetodoCobro,
  type TonoEstado,
} from "@/lib/billing-ve"
import { apiAnularFactura, apiRegistrarPago } from "@/lib/api-facturacion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatearDocumentoIdentidad } from "@/lib/fiscal-ve"
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

export function DetalleFactura({
  clinicSlug,
  factura,
  puedeCobrar,
  puedeAnular,
  onActualizada,
  onCerrar,
}: {
  clinicSlug: string
  factura: FacturaDTO
  puedeCobrar: boolean
  puedeAnular: boolean
  onActualizada: (factura: FacturaDTO) => void
  onCerrar: () => void
}) {
  const [metodo, setMetodo] = useState<PaymentMethod>("PAGO_MOVIL")
  const [monto, setMonto] = useState("")
  const [referencia, setReferencia] = useState("")
  const [verificar, setVerificar] = useState(true)
  const [ocupado, setOcupado] = useState<"cobro" | "nota" | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const [tipoNota, setTipoNota] = useState<"CREDITO" | "DEBITO">("CREDITO")
  const [motivo, setMotivo] = useState("")
  const [montoNota, setMontoNota] = useState("")
  const [reembolsar, setReembolsar] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  const infoMetodo = infoMetodoCobro(metodo)
  const editable =
    factura.status === "ISSUED" || factura.status === "PAID"

  const cobroPreview = useMemo(() => {
    const montoNumero = Number(monto.replace(",", ".")) || 0
    if (montoNumero <= 0) return null
    return desglosarCobro({ metodo, montoUSD: montoNumero, tasa: factura.bcvRate })
  }, [factura.bcvRate, metodo, monto])

  function aplicarFactura(actualizada: FacturaDTO) {
    setMonto("")
    setReferencia("")
    setMotivo("")
    setMontoNota("")
    onActualizada(actualizada)
  }

  async function registrarCobro() {
    const montoNumero = Number(monto.replace(",", ".")) || 0
    if (montoNumero <= 0) {
      setToast({ tipo: "error", mensaje: "Indica el monto cobrado." })
      return
    }

    setOcupado("cobro")
    const respuesta = await apiRegistrarPago(clinicSlug, factura.id, {
      method: metodo,
      amountUSD: montoNumero,
      amountVES: null,
      referenceNumber: referencia || null,
      notes: null,
      verificar,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setToast({
      tipo: "ok",
      mensaje: `Cobro registrado${
        respuesta.data.desglose.igtfUSD > 0
          ? ` con IGTF de ${formatUSD(respuesta.data.desglose.igtfUSD)}`
          : ""
      }.`,
    })
    aplicarFactura(respuesta.data.factura)
  }

  async function emitirNotaAjuste() {
    const montoNumero = Number(montoNota.replace(",", ".")) || null
    setOcupado("nota")
    const respuesta = await apiAnularFactura(clinicSlug, factura.id, {
      tipo: tipoNota,
      motivo,
      montoUSD: montoNumero,
      reembolsar,
    })
    setOcupado(null)

    if (!respuesta.ok) {
      setToast({ tipo: "error", mensaje: respuesta.message })
      return
    }

    setToast({
      tipo: "ok",
      mensaje: `Nota ${
        tipoNota === "CREDITO" ? "de crédito" : "de débito"
      } ${respuesta.data.nota.noteNumber ?? ""} emitida (${
        respuesta.data.nota.controlNumber ?? ""
      }).`,
    })
    aplicarFactura(respuesta.data.factura)
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tracking-tight tabular-nums">
              {factura.invoiceNumber ?? "Borrador"}
            </span>
            {factura.controlNumber && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                Control {factura.controlNumber}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                CLASE_TONO[TONO_ESTADO_FACTURA[factura.status]]
              )}
            >
              {ETIQUETA_ESTADO_FACTURA[factura.status]}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                CLASE_TONO[TONO_ESTADO_COBRO[factura.paymentStatus]]
              )}
            >
              {ETIQUETA_ESTADO_COBRO[factura.paymentStatus]}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(factura.createdAt).toLocaleString("es-VE", {
              timeZone: "America/Caracas",
            })}
            {factura.sedeNombre ? ` · ${factura.sedeNombre}` : ""} · Tasa{" "}
            {formatBs(factura.bcvRate)}/USD
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar detalle"
          onClick={onCerrar}
        >
          <X className="size-4" />
        </Button>
      </header>

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-xl border p-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <UserRound className="size-3.5" aria-hidden="true" />
            Datos fiscales
          </span>
          <span className="font-medium">{factura.fiscalProfile.razonSocial}</span>
          <span className="text-sm text-muted-foreground">
            {factura.fiscalProfile.tipoDocumento &&
            factura.fiscalProfile.documentoIdentidad
              ? formatearDocumentoIdentidad(
                  factura.fiscalProfile.tipoDocumento,
                  factura.fiscalProfile.documentoIdentidad
                )
              : factura.fiscalProfile.documentoIdentidad}
          </span>
          <span className="text-sm text-muted-foreground">
            {factura.fiscalProfile.direccionFiscal}
          </span>
          {(factura.fiscalProfile.email || factura.fiscalProfile.telefono) && (
            <span className="text-xs text-muted-foreground">
              {[factura.fiscalProfile.email, factura.fiscalProfile.telefono]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 rounded-xl border p-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Receipt className="size-3.5" aria-hidden="true" />
            Totales
          </span>
          <span className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatUSD(factura.subtotalUSD)} · {formatBs(factura.subtotalVES)}
            </span>
          </span>
          <span className="flex justify-between text-sm">
            <span>IVA</span>
            <span className="tabular-nums">
              {formatUSD(factura.vatUSD)} · {formatBs(factura.vatVES)}
            </span>
          </span>
          <span className="flex justify-between text-sm">
            <span>IGTF cobrado</span>
            <span className="tabular-nums">
              {formatUSD(factura.igtfUSD)} · {formatBs(factura.igtfVES)}
            </span>
          </span>
          <span className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatUSD(factura.totalUSD)} · {formatBs(factura.totalVES)}
            </span>
          </span>
          <span className="flex justify-between text-sm text-muted-foreground">
            <span>Cobrado / saldo</span>
            <span className="tabular-nums">
              {formatUSD(factura.pagadoUSD)} / {formatUSD(factura.saldoUSD)}
            </span>
          </span>
        </div>
      </div>

      {/* Detalle de líneas */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Detalle de la factura
        </span>
        <ul className="flex flex-col divide-y rounded-xl border">
          {factura.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {item.description}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.quantity} × {formatUSD(item.unitPriceUSD)} ·{" "}
                  {item.taxable ? "IVA 16%" : "Exento"}
                  {item.doctorCommissionAmount > 0
                    ? ` · honorario ${formatUSD(item.doctorCommissionAmount)}`
                    : ""}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatUSD(item.totalUSD)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Cobros */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cobros registrados ({factura.pagos.length})
        </span>
        {factura.pagos.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Sin cobros registrados.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {factura.pagos.map((pago) => (
              <li
                key={pago.id}
                className="flex flex-wrap items-center gap-2 p-3 text-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {infoMetodoCobro(pago.method).label}
                    {pago.referenceNumber ? ` · ref. ${pago.referenceNumber}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(pago.createdAt).toLocaleString("es-VE", {
                      timeZone: "America/Caracas",
                    })}
                    {pago.appliesIgtf
                      ? ` · IGTF ${formatUSD(pago.igtfAmountUSD)}`
                      : " · sin IGTF"}
                  </span>
                </div>
                <span className="font-semibold tabular-nums">
                  {formatUSD(pago.amountUSD)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    CLASE_TONO[TONO_ESTADO_PAGO[pago.status]]
                  )}
                >
                  {ETIQUETA_ESTADO_PAGO[pago.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Registrar cobro */}
      {puedeCobrar && editable && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <PlusCircle className="size-4 text-primary" aria-hidden="true" />
            Registrar cobro
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Método</Label>
              <select
                value={metodo}
                onChange={(evento) =>
                  setMetodo(evento.target.value as PaymentMethod)
                }
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {METODOS_COBRO.map((valor) => {
                  const info = infoMetodoCobro(valor)
                  return (
                    <option key={valor} value={valor}>
                      {info.label}
                      {info.aplicaIgtf ? " · IGTF 3%" : ""}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Monto USD</Label>
              <Input
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                inputMode="decimal"
                placeholder={String(factura.saldoUSD || factura.totalUSD)}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
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
          </div>

          {cobroPreview && (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Base {formatUSD(cobroPreview.baseUSD)} (
              {formatBs(cobroPreview.baseVES)})
              {cobroPreview.igtfUSD > 0
                ? ` + IGTF ${formatUSD(cobroPreview.igtfUSD)} (${formatBs(cobroPreview.igtfVES)})`
                : " · sin IGTF"}{" "}
              ={" "}
              <strong className="text-foreground">
                {formatUSD(cobroPreview.totalUSD)}
              </strong>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={verificar}
                onChange={(evento) => setVerificar(evento.target.checked)}
                className="size-4 rounded border-input"
              />
              Marcar como verificado
            </label>
            <Button
              type="button"
              onClick={() => void registrarCobro()}
              disabled={ocupado !== null}
              className="h-10 gap-2 rounded-xl px-4"
            >
              {ocupado === "cobro" && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Guardar cobro
            </Button>
            {factura.saldoUSD > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMonto(String(factura.saldoUSD))}
                className="h-10 rounded-xl text-xs"
              >
                Usar saldo ({formatUSD(factura.saldoUSD)})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Notas de ajuste fiscal */}
      {(factura.notas.length > 0 || (puedeAnular && editable)) && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
            Notas de ajuste fiscal
          </span>

          {factura.notas.length > 0 && (
            <ul className="flex flex-col divide-y rounded-xl border">
              {factura.notas.map((nota) => (
                <li
                  key={nota.id}
                  className="flex flex-wrap items-center gap-2 p-3 text-sm"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {nota.tipo === "CREDITO" ? "Nota de crédito" : "Nota de débito"}{" "}
                      {nota.noteNumber ?? ""}
                      {nota.controlNumber ? ` · control ${nota.controlNumber}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {nota.motivo}
                      {nota.reembolsada ? " · con reembolso" : ""}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatUSD(nota.amountUSD)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {puedeAnular && editable && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Tipo de nota</Label>
                  <select
                    value={tipoNota}
                    onChange={(evento) =>
                      setTipoNota(evento.target.value as "CREDITO" | "DEBITO")
                    }
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="CREDITO">Crédito (anular / ajuste a favor)</option>
                    <option value="DEBITO">Débito (cargo adicional)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Monto USD {tipoNota === "CREDITO" ? "(opcional)" : "*"}
                  </Label>
                  <Input
                    value={montoNota}
                    onChange={(evento) => setMontoNota(evento.target.value)}
                    inputMode="decimal"
                    placeholder={String(factura.totalUSD)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Motivo *</Label>
                  <Input
                    value={motivo}
                    onChange={(evento) => setMotivo(evento.target.value)}
                    placeholder="Error en el monto / consulta no realizada"
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {tipoNota === "CREDITO" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={reembolsar}
                      onChange={(evento) => setReembolsar(evento.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    Se devolvió el dinero al paciente (reembolso)
                  </label>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void emitirNotaAjuste()}
                  disabled={ocupado !== null || motivo.trim().length < 5}
                  className="h-10 gap-2 rounded-xl px-4"
                >
                  {ocupado === "nota" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" aria-hidden="true" />
                  )}
                  {tipoNota === "CREDITO" ? "Anular con nota de crédito" : "Emitir nota de débito"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Las notas consumen su propia numeración y N° de control.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
