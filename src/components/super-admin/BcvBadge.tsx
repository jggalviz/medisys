import { DollarSign } from "lucide-react"

import { createAdminClient } from "@/lib/supabase/admin"
import { getResumenTasaBcv, type BcvRateSource } from "@/lib/bcv"

/** Etiqueta corta de la fuente de la tasa. */
const ETIQUETA_FUENTE: Record<BcvRateSource, string> = {
  "bcv-web": "En vivo · BCV",
  dolarapi: "API alternativa",
  pydolarve: "API alternativa",
  db: "Última guardada",
  fallback: "Respaldo",
}

function formatearBs(valor: number): string {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(iso: string | null): string | null {
  if (!iso) return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha)
}

/** Esqueleto mientras se resuelve la tasa (Suspense). */
export function BcvBadgeSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-44 animate-pulse items-center gap-2 rounded-full border bg-muted/50 px-3"
    >
      <span className="size-4 rounded-full bg-muted" />
      <span className="h-3 w-28 rounded-full bg-muted" />
    </span>
  )
}

/**
 * Badge "Tasa BCV Oficial" del panel Super Admin.
 * Usa la cascada de `@/lib/bcv` (web del BCV → APIs → último valor en
 * `bcv_rates`) con caché de 1 hora en las peticiones externas.
 */
export async function BcvBadge() {
  let resumen
  try {
    resumen = await getResumenTasaBcv(createAdminClient())
  } catch {
    return null
  }

  const fecha = formatearFecha(resumen.actualizadoEn)
  const esEnVivo =
    resumen.fuente === "bcv-web" ||
    resumen.fuente === "dolarapi" ||
    resumen.fuente === "pydolarve"

  return (
    <span
      title={`Fuente: ${resumen.detalle}`}
      className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-500/30 dark:bg-emerald-950/40"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        <DollarSign className="size-3.5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
          Tasa BCV Oficial
        </span>
        <span className="text-sm font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
          Bs. {formatearBs(resumen.tasa)} / USD
        </span>
      </span>
      <span className="hidden flex-col leading-tight border-l border-emerald-200 pl-2.5 text-[10px] text-emerald-700/90 sm:flex dark:border-emerald-500/30 dark:text-emerald-400">
        <span className="font-semibold">
          {ETIQUETA_FUENTE[resumen.fuente] ?? "Tasa"}
        </span>
        <span>
          {esEnVivo
            ? "Actualizada ahora"
            : fecha
              ? `Actualizada ${fecha}`
              : "Sin registro previo"}
        </span>
      </span>
    </span>
  )
}
