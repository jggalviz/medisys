import Link from "next/link"
import { AlertTriangle, CalendarClock } from "lucide-react"

import { formatearVencimiento } from "@/lib/suscripcion"
import { cn } from "@/lib/utils"

type Props = {
  clinicSlug: string
  planLabel: string
  venceAt: string | null
  dias: number
  vencida: boolean
}

/**
 * Banner de alerta de membresía. Se muestra cuando vence en ≤ 5 días o ya
 * venció, con acceso directo a la renovación.
 */
export function BannerMembresia({
  clinicSlug,
  planLabel,
  venceAt,
  dias,
  vencida,
}: Props) {
  const detalle = vencida
    ? `Tu membresía ${planLabel} venció el ${formatearVencimiento(venceAt)}.`
    : `Tu membresía ${planLabel} vence el ${formatearVencimiento(venceAt)}${
        dias === 1 ? " (mañana)" : ` (en ${dias} días)`
      }.`

  return (
    <section
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        vencida
          ? "border-red-300/70 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
          : "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            vencida ? "bg-red-500/15" : "bg-amber-500/15"
          )}
        >
          {vencida ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CalendarClock className="size-4" />
          )}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {vencida ? "Membresía vencida" : "Tu membresía está por vencer"}
          </p>
          <p className="text-sm opacity-90">
            {detalle} Puedes renovar ahora para evitar interrupciones en tu
            servicio. Al pagar se sumarán +30 días a tu fecha de vencimiento
            actual.
          </p>
        </div>
      </div>
      <Link
        href={`/${clinicSlug}/admin/renovar-membresia`}
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90",
          vencida ? "bg-red-600" : "bg-amber-600"
        )}
      >
        Renovar Membresía
      </Link>
    </section>
  )
}
