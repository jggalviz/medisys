/**
 * MEDISYS · Caso de estudio (`/proceso-saas`)
 * ------------------------------------------------------------------
 * Piezas de contenido reutilizables: KPIs, bloques de código, avisos,
 * listas de verificación y flujos numerados.
 */
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import type { Metrica } from "@/components/caso-estudio/constantes"

/* ------------------------------- KPIs ------------------------------ */

export function KpiGrid({
  items,
  dark = false,
  className,
}: {
  items: readonly Metrica[]
  dark?: boolean
  className?: string
}) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3",
        dark ? "border-white/10 bg-white/10" : "border-zinc-200 bg-zinc-200",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("p-5", dark ? "bg-zinc-950" : "bg-white")}
        >
          <dd
            className={cn(
              "font-mono text-3xl font-bold tabular-nums",
              dark ? "text-teal-300" : "text-zinc-900"
            )}
          >
            {item.valor}
          </dd>
          <dt
            className={cn(
              "mt-1 text-sm font-semibold",
              dark ? "text-zinc-200" : "text-zinc-800"
            )}
          >
            {item.label}
          </dt>
          <p
            className={cn(
              "mt-1 text-xs leading-5",
              dark ? "text-zinc-500" : "text-zinc-500"
            )}
          >
            {item.detalle}
          </p>
        </div>
      ))}
    </dl>
  )
}

/* ---------------------------- Código ------------------------------- */

/** Bloque de código con cabecera tipo editor (JetBrains-less: Geist Mono). */
export function CodePanel({
  ruta,
  nota,
  children,
  className,
}: {
  /** Ruta del archivo real del repositorio al que pertenece el fragmento. */
  ruta: string
  nota?: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-white/10 bg-zinc-950", className)}>
      <figcaption className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/80 px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </span>
        <span className="truncate font-mono text-[11px] text-zinc-400">{ruta}</span>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-6 text-zinc-200">
        <code>{children}</code>
      </pre>
      {nota ? (
        <p className="border-t border-white/10 bg-zinc-900/40 px-4 py-2.5 text-xs leading-5 text-zinc-400">
          {nota}
        </p>
      ) : null}
    </figure>
  )
}

/* ----------------------------- Avisos ------------------------------ */

export function Callout({
  icon: Icon,
  titulo,
  children,
  tone = "teal",
  className,
}: {
  icon: LucideIcon
  titulo: string
  children: ReactNode
  tone?: "teal" | "amber"
  className?: string
}) {
  const tonos = {
    teal: "border-teal-200 bg-teal-50/70 text-teal-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-900",
  }
  return (
    <div className={cn("rounded-2xl border p-5", tonos[tone], className)}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" aria-hidden="true" />
        {titulo}
      </p>
      <div className="mt-2 text-sm leading-6 text-zinc-700">{children}</div>
    </div>
  )
}

/* ---------------------------- Listas ------------------------------- */

export function ListaChecks({
  items,
  icon: Icon,
  dark = false,
  className,
}: {
  items: readonly string[]
  icon: LucideIcon
  dark?: boolean
  className?: string
}) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              dark ? "text-teal-300" : "text-teal-600"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "text-sm leading-6",
              dark ? "text-zinc-300" : "text-zinc-600"
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------- Flujos ------------------------------- */

export type Paso = {
  titulo: string
  detalle: string
  icon: LucideIcon
}

export function FlujoPasos({
  pasos,
  className,
}: {
  pasos: readonly Paso[]
  className?: string
}) {
  return (
    <ol className={cn("grid gap-4 md:grid-cols-3", className)}>
      {pasos.map((paso, indice) => {
        const Icono = paso.icon
        return (
        <li
          key={paso.titulo}
          className="relative rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 tabular-nums">
              {String(indice + 1).padStart(2, "0")}
            </span>
            <Icono className="size-3.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-900">{paso.titulo}</p>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">{paso.detalle}</p>
        </li>
        )
      })}
    </ol>
  )
}
