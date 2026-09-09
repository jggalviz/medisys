"use client"

/**
 * Tarjeta financiera del Dashboard con conmutación USD / VES (Bolívares).
 * Los montos se reciben en USD; en modo VES se multiplican por `tasaBCV`.
 */
import { useState } from "react"
import { Banknote } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  /** Total estimado del día (USD) = Σ precio_consulta de las citas. */
  ingresosUsd: number
  /** Monto aún por validar (USD), mostrado como subtexto. */
  porValidarUsd: number
  tasaBCV: number
}

type Moneda = "USD" | "VES"

function formatoUsd(monto: number): string {
  return `$ ${monto.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatoVes(monto: number): string {
  return `Bs. ${monto.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function TarjetaRecaudacion({
  ingresosUsd,
  porValidarUsd,
  tasaBCV,
}: Props) {
  const [moneda, setMoneda] = useState<Moneda>("USD")

  const activo = (usd: number) => (moneda === "USD" ? usd : usd * tasaBCV)
  const formatear = (monto: number) =>
    moneda === "USD" ? formatoUsd(monto) : formatoVes(monto)

  return (
    <article className="flex min-h-full min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-card to-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Banknote className="size-5" aria-hidden="true" />
          </span>
          <span className="truncate text-[13px] font-medium text-muted-foreground">
            Ingresos del día
          </span>
        </div>

        {/* Toggle USD / VES */}
        <div
          role="group"
          aria-label="Moneda de la recaudación"
          className="flex shrink-0 flex-wrap rounded-full border bg-muted/60 p-0.5 text-[11px] font-semibold"
        >
          <button
            type="button"
            aria-pressed={moneda === "USD"}
            onClick={() => setMoneda("USD")}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              moneda === "USD"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            USD ($)
          </button>
          <button
            type="button"
            aria-pressed={moneda === "VES"}
            onClick={() => setMoneda("VES")}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              moneda === "VES"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            VES (Bs.)
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-2xl font-bold tracking-tight tabular-nums">
          {formatear(activo(ingresosUsd))}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          por validar {formatear(activo(porValidarUsd))}
        </span>
      </div>

      {moneda === "VES" && (
        <span className="inline-flex w-fit max-w-full items-center gap-1.5 overflow-hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          <span aria-hidden="true">🏦</span>
          <span className="truncate">
            Tasa BCV:{" "}
            {tasaBCV.toLocaleString("es-VE", { minimumFractionDigits: 2 })}{" "}
            Bs/USD
          </span>
        </span>
      )}
    </article>
  )
}
