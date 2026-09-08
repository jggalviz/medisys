"use client"

/**
 * Vista de recepción: pagos pendientes de validación.
 *
 * - Lista responsiva de citas con estado `pendiente_validacion`.
 * - Botones Aprobar / Rechazar con estado de carga y feedback visual.
 * - Modal para previsualizar el comprobante del bucket 'comprobantes'.
 */
import { useCallback, useEffect, useState } from "react"
import { BadgeCheck, FileImage, LoaderCircle, ShieldAlert, X } from "lucide-react"

import type { PendingPaymentItem } from "@/types/admin"
import { getPendingPayments, validatePayment } from "@/app/actions/admin"
import { formatLongDate } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Feedback = { tipo: "ok" | "error"; mensaje: string } | null

type BusyState = {
  id: string
  accion: "aprobar" | "rechazar"
} | null

const ETIQUETAS_TURNO: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
}

function formatoFechaHora(iso: string): { fecha: string; hora: string | null } {
  const fecha = iso.slice(0, 10)
  const hora = iso.length >= 16 ? iso.slice(11, 16) : null
  return {
    fecha: fecha ? formatLongDate(fecha) : "Fecha no registrada",
    hora,
  }
}

function nombrePaciente(item: PendingPaymentItem): string {
  const p = item.paciente
  if (!p) return "Paciente invitado"
  return [p.nombres, p.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre"
}

function nombreEspecialista(item: PendingPaymentItem): string {
  const d = item.especialista
  if (!d) return "Especialista no encontrado"
  return [d.nombres, d.apellidos].filter(Boolean).join(" ").trim() || d.especialidad
}

/* ------------------------------------------------------------------ */
/* Esqueleto de carga                                                  */
/* ------------------------------------------------------------------ */

function PagosSkeleton() {
  return (
    <ul
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Cargando pagos pendientes"
    >
      {[0, 1, 2].map((n) => (
        <li
          key={n}
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
          <div className="mt-1 flex flex-wrap gap-2">
            <div className="h-10 w-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 w-28 animate-pulse rounded-xl bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Modal de comprobante                                                */
/* ------------------------------------------------------------------ */

function ComprobanteModal({
  item,
  onClose,
}: {
  item: PendingPaymentItem
  onClose: () => void
}) {
  const url = item.comprobante_url
  const [broken, setBroken] = useState(false)
  const esPdf = url?.toLowerCase().endsWith(".pdf") ?? false

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comprobante de ${nombrePaciente(item)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">
              Comprobante de pago · {nombrePaciente(item)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Ref. {item.referencia_pago ?? "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista del comprobante"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-[18rem] flex-1 items-center justify-center overflow-auto bg-zinc-950 p-4">
          {!url ? (
            <p className="text-sm text-zinc-400">
              Esta cita no tiene comprobante adjunto.
            </p>
          ) : esPdf ? (
            <p className="flex max-w-md flex-col items-center gap-3 text-center text-sm text-zinc-300">
              <FileImage className="size-8 opacity-70" />
              El comprobante es un PDF. Ábrelo en otra pestaña para revisarlo.
            </p>
          ) : !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- Captura alojada en Supabase Storage (URL pública).
            <img
              src={url}
              alt={`Comprobante de pago de ${nombrePaciente(item)}`}
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : (
            <p className="max-w-md text-center text-sm text-zinc-400">
              No se pudo cargar la imagen del comprobante.
            </p>
          )}
        </div>

        {url && (
          <div className="flex items-center justify-end gap-3 border-t px-4 py-3">
            <Button
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Abrir original
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PagosVerificacion({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<PendingPaymentItem[]>([])
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading")
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState<BusyState>(null)
  const [preview, setPreview] = useState<PendingPaymentItem | null>(null)

  const cargar = useCallback(() => {
    setStatus("loading")
    setError(null)
    void getPendingPayments(tenantId).then((result) => {
      if (result.ok) {
        setItems(result.data)
        setStatus("ok")
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
  }, [tenantId])

  useEffect(() => {
    let active = true
    void getPendingPayments(tenantId).then((result) => {
      if (!active) return
      if (result.ok) {
        setItems(result.data)
        setStatus("ok")
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
    return () => {
      active = false
    }
  }, [tenantId])

  async function decidir(item: PendingPaymentItem, approved: boolean) {
    setBusy({ id: item.id, accion: approved ? "aprobar" : "rechazar" })
    setFeedback(null)

    const result = await validatePayment({
      appointmentId: item.id,
      approved,
    })

    setBusy(null)

    if (result.ok) {
      const accion = approved ? "Pago aprobado" : "Pago rechazado"
      setFeedback({ tipo: "ok", mensaje: `${accion}: ${nombrePaciente(item)}` })
      setPreview((prev) => (prev?.id === item.id ? null : prev))
      setItems((prev) => prev.filter((pago) => pago.id !== item.id))
      return
    }

    setFeedback({ tipo: "error", mensaje: result.message })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de estado */}
      <div className="flex flex-col gap-2">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Consultando pagos pendientes…
          </p>
        )}
        {status === "ok" && (
          <p className="text-sm text-muted-foreground">
            {items.length}{" "}
            {items.length === 1 ? "pago pendiente" : "pagos pendientes"} de
            validación
          </p>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
            feedback.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.tipo === "ok" ? (
            <BadgeCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          )}
          {feedback.mensaje}
        </div>
      )}

      {status === "loading" && <PagosSkeleton />}

      {status === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="size-4" />
            No pudimos cargar los pagos
          </p>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {status === "ok" && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-8 text-center">
          <BadgeCheck className="size-8 text-emerald-600" />
          <p className="font-semibold">Sin pagos por validar</p>
          <p className="text-sm text-muted-foreground">
            Cuando un paciente pague en línea y adjunte su comprobante,
            aparecerá aquí.
          </p>
        </div>
      )}

            {status === "ok" && items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const estaOcupado = busy?.id === item.id
            return (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold">{nombrePaciente(item)}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.paciente?.cedula
                        ? `C.I. ${item.paciente.cedula}`
                        : "Sin cédula"}
                      {item.paciente?.telefono
                        ? ` · ${item.paciente.telefono}`
                        : ""}
                    </span>
                  </div>
                  <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <LoaderCircle className="size-3 animate-pulse" aria-hidden="true" />
                    Por validar
                  </Badge>
                </div>

                <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Fila
                    label="Especialista"
                    valor={`${nombreEspecialista(item)}${
                      item.especialista
                        ? ` · ${item.especialista.especialidad}`
                        : ""
                    }`}
                  />
                  <Fila
                    label="Fecha y turno"
                    valor={(() => {
                      const f = formatoFechaHora(item.fecha_hora)
                      const turno = item.turno
                        ? `Turno ${ETIQUETAS_TURNO[item.turno]}`
                        : null
                      return [f.fecha, turno, f.hora].filter(Boolean).join(" · ")
                    })()}
                  />
                  <Fila label="Referencia" valor={item.referencia_pago ?? "—"} />
                  <Fila
                    label="Teléfono emisor"
                    valor={item.telefono_emisor ?? "—"}
                  />
                  <Fila label="Banco de origen" valor={item.banco_origen ?? "—"} />
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  {item.comprobante_url && (
                    <Button
                      variant="outline"
                      onClick={() => setPreview(item)}
                      disabled={Boolean(busy)}
                    >
                      <FileImage className="size-4" />
                      Ver comprobante
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => void decidir(item, false)}
                    disabled={Boolean(busy)}
                    className="gap-2"
                  >
                    {estaOcupado && busy?.accion === "rechazar" && (
                      <LoaderCircle className="size-4 animate-spin" />
                    )}
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => void decidir(item, true)}
                    disabled={Boolean(busy)}
                    className="gap-2"
                  >
                    {estaOcupado && busy?.accion === "aprobar" && (
                      <LoaderCircle className="size-4 animate-spin" />
                    )}
                    <BadgeCheck className="size-4" />
                    Aprobar pago
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {preview && (
        <ComprobanteModal item={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 pb-1 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm font-medium">{valor}</dd>
    </div>
  )
}