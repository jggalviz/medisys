"use client"

/**
 * MEDISYS · Selector visual de planes del registro (`/registro`).
 *
 * Radio-group nativo estilizado como tarjetas: navegación con flechas y
 * selección con Enter/Espacio gratis, un único tab-stop (roving tabindex) y
 * borde verde institucional `#00a896` en el plan activo.
 *
 * Las tarjetas se generan recorriendo `PLANES_TENANT` (fuente única de los
 * planes comerciales de `@/lib/suscripcion`, espejo del CHECK de la migración
 * 0020), de modo que un plan nuevo en la BD exige su texto aquí.
 *
 * El botón (i) vive FUERA del `<label>` (hermano posicionado encima) para no
 * activar la selección al abrir la explicación.
 */
import type { PlanTenant } from "@/types/database"
import { PLANES_TENANT } from "@/lib/suscripcion"
import { InfoPopover } from "@/components/ui/info-popover"
import { cn } from "@/lib/utils"

type TextoPlan = {
  /** Nombre corto mostrado en la tarjeta. */
  nombre: string
  /** Capacidad del plan ("1 Médico / Especialista", "Hasta 5 Especialistas"…). */
  detalle: string
  /** Explicación de para quién es el plan (popup de información). */
  info: string
  /** Etiqueta destacada opcional. */
  badge?: string
}

/** Copy de las tarjetas (mismo lenguaje que la sección de precios de la landing). */
const TEXTOS: Record<PlanTenant, TextoPlan> = {
  INDIVIDUAL: {
    nombre: "Individual",
    detalle: "1 Médico / Especialista",
    info: "Ideal para médicos independientes, nutricionistas o psicólogos que manejan su propia agenda y consulta única.",
  },
  PYME: {
    nombre: "PyME",
    detalle: "Hasta 5 Especialistas",
    info: "Ideal para pequeños centros médicos, estéticas o consultorios compartidos con recepción o asistente.",
    badge: "Recomendado",
  },
  PRO: {
    nombre: "Pro",
    detalle: "Especialistas Ilimitados",
    info: "Ideal para clínicas, policlínicas o centros médicos medianos/grandes que requieren múltiples especialidades y sedes.",
  },
}

type Props = {
  /** Plan actualmente seleccionado (controlado por el formulario). */
  valor: PlanTenant
  /** Notifica el cambio de plan. */
  onChange: (plan: PlanTenant) => void
  /** Mensaje de error del plan (validación del servidor). */
  error?: string | null
}

export function PlanSelector({ valor, onChange, error }: Props) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-0.5 text-sm font-medium leading-none">
        Elige tu plan *
      </legend>

      <div
        role="radiogroup"
        aria-label="Plan de Medisys"
        aria-invalid={Boolean(error) || undefined}
        className="flex flex-col gap-2"
      >
        {PLANES_TENANT.map((plan) => {
          const texto = TEXTOS[plan]
          const activo = plan === valor
          const id = `reg-plan-${plan.toLowerCase()}`

          return (
            <div key={plan} className="relative">
              <label
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 pr-10 transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#00a896]/40",
                  activo
                    ? "border-[#00a896] bg-[#00a896]/10 ring-1 ring-[#00a896]"
                    : "border-border hover:border-[#00a896]/50 hover:bg-[#00a896]/5"
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name="plan"
                  value={plan}
                  checked={activo}
                  onChange={() => onChange(plan)}
                  className="sr-only"
                />

                {/* Marca de selección */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    activo
                      ? "border-[#00a896] bg-[#00a896]"
                      : "border-muted-foreground/40 bg-background"
                  )}
                >
                  {activo && (
                    <span className="size-1.5 rounded-full bg-white" />
                  )}
                </span>

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold leading-tight">
                      {texto.nombre}
                    </span>
                    {texto.badge && (
                      <span className="rounded-full bg-[#00a896]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#028090]">
                        {texto.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {texto.detalle}
                  </span>
                </span>
              </label>

              <span className="absolute right-1.5 top-1.5 z-10">
                <InfoPopover
                  titulo={`Plan ${texto.nombre}`}
                  etiqueta={`Para quién es el Plan ${texto.nombre}`}
                  side="top"
                >
                  {texto.info}
                </InfoPopover>
              </span>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
