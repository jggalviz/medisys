"use client"

/** Super Admin · validación de pagos de suscripción pendientes. */
import { useState } from "react"
import { BadgeCheck, FileImage, Inbox, LoaderCircle, X } from "lucide-react"

import {
  aprobarPagoSuscripcion,
  rechazarPagoSuscripcion,
  type PagoSuscripcionPendiente,
} from "@/app/actions/super-admin-suscripcion"
import { formatBs, formatUSD } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = { pagos: PagoSuscripcionPendiente[] }

type Busy = { id: string; accion: "aprobar" | "rechazar" } | null

function fechaCorta(iso: string): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function PagosSuscripcion({ pagos }: Props) {
  const [items, setItems] = useState<PagoSuscripcionPendiente[]>(pagos)
  const [busy, setBusy] = useState<Busy>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function decidir(pago: PagoSuscripcionPendiente, aprobar: boolean) {
    if (busy) return
    setBusy({ id: pago.id, accion: aprobar ? "aprobar" : "rechazar" })
    setAviso(null)

    const resultado = aprobar
      ? await aprobarPagoSuscripcion(pago.id)
      : await rechazarPagoSuscripcion(pago.id)

    setBusy(null)

    if (!resultado.ok) {
      setAviso(resultado.message)
      return
    }

    setItems((prev) => prev.filter((p) => p.id !== pago.id))
    setAviso(
      aprobar
        ? `Pago de ${pago.tenantNombre} aprobado. Membresía extendida +30 días.`
        : `Pago de ${pago.tenantNombre} rechazado.`
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-4 py-12 text-center">
        <Inbox className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Sin pagos pendientes</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cuando una clínica reporte el pago de su membresía aparecerá aquí para
          su validación.
        </p>
        {aviso && (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{aviso}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {aviso}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {items.map((pago) => {
          const ocupado = busy?.id === pago.id
          return (
            <li key={pago.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{pago.tenantNombre}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    /{pago.tenantSlug} · {pago.planType}
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    pago.planType === "PRO"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {formatUSD(pago.montoUsd)} · {formatBs(pago.montoVes)}
                </span>
              </div>

              <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                <Fila label="Referencia" valor={pago.referencia} />
                <Fila label="Banco origen" valor={pago.bancoOrigen ?? "—"} />
                <Fila label="Teléfono emisor" valor={pago.telefonoEmisor ?? "—"} />
                <Fila label="Fecha del reporte" valor={fechaCorta(pago.createdAt)} />
                <Fila label="Tasa BCV" valor={`${pago.tasaBcv.toFixed(2)} Bs./USD`} />
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                {pago.comprobanteUrl && (
                  <a
                    href={pago.comprobanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/50"
                  >
                    <FileImage className="size-4" />
                    Ver comprobante
                  </a>
                )}
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={Boolean(busy)}
                  onClick={() => void decidir(pago, false)}
                >
                  {ocupado && busy?.accion === "rechazar" && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                  <X className="size-4" />
                  Rechazar
                </Button>
                <Button
                  className="gap-2"
                  disabled={Boolean(busy)}
                  onClick={() => void decidir(pago, true)}
                >
                  {ocupado && busy?.accion === "aprobar" && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}
                  <BadgeCheck className="size-4" />
                  Aprobar Pago
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
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
