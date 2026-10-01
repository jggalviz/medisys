/**
 * MEDISYS · Caso de estudio (`/proceso-saas`)
 * ------------------------------------------------------------------
 * Primitivas de layout, tipografía y superficie compartidas por todas las
 * secciones. Todas son Server Components: no hay estado ni efectos.
 */
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type Tono = "light" | "muted" | "dark"

/* ------------------------------ Layout ----------------------------- */

export function Container({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 lg:px-8", className)}>
      {children}
    </div>
  )
}

const TONO_SECCION: Record<Tono, string> = {
  light: "bg-white text-zinc-900",
  muted: "bg-zinc-50 text-zinc-900",
  dark: "bg-zinc-950 text-zinc-100",
}

export function Section({
  id,
  tone = "light",
  className,
  children,
}: {
  id?: string
  tone?: Tono
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-16 py-20 sm:py-24", TONO_SECCION[tone], className)}
    >
      <Container>{children}</Container>
    </section>
  )
}

/* ---------------------------- Tipografía --------------------------- */

/** Numeración + etiqueta de sección, al estilo de un caso de estudio. */
export function IndiceSeccion({
  indice,
  icon: Icon,
  children,
  dark = false,
}: {
  indice: string
  icon: LucideIcon
  children: ReactNode
  dark?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em]",
        dark ? "text-teal-300" : "text-teal-700"
      )}
    >
      <span
        className={cn(
          "rounded-md border px-1.5 py-0.5 tabular-nums",
          dark ? "border-white/15 bg-white/5" : "border-teal-200 bg-teal-50"
        )}
      >
        {indice}
      </span>
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

export function SectionHeading({
  indice,
  eyebrow,
  title,
  description,
  icon,
  tone = "light",
  className,
}: {
  indice: string
  eyebrow: string
  title: ReactNode
  description: ReactNode
  icon: LucideIcon
  tone?: Tono
  className?: string
}) {
  const dark = tone === "dark"
  return (
    <div className={cn("max-w-3xl", className)}>
      <IndiceSeccion indice={indice} icon={icon} dark={dark}>
        {eyebrow}
      </IndiceSeccion>
      <h2
        className={cn(
          "mt-4 text-3xl font-bold tracking-tight sm:text-4xl",
          dark ? "text-white" : "text-zinc-900"
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-4 text-base leading-7",
          dark ? "text-zinc-300" : "text-zinc-600"
        )}
      >
        {description}
      </p>
    </div>
  )
}

/* ---------------------------- Superficies -------------------------- */

export function Chip({
  icon: Icon,
  children,
  dark = false,
  className,
}: {
  icon?: LucideIcon
  children: ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium",
        dark
          ? "border-white/15 bg-white/5 text-zinc-300"
          : "border-zinc-200 bg-white text-zinc-600",
        className
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export function Panel({
  tone = "light",
  className,
  children,
}: {
  tone?: Tono
  className?: string
  children: ReactNode
}) {
  const estilos: Record<Tono, string> = {
    light: "border-zinc-200 bg-white",
    muted: "border-zinc-200 bg-zinc-50",
    dark: "border-white/10 bg-zinc-900/60",
  }
  return (
    <div className={cn("rounded-2xl border p-6", estilos[tone], className)}>
      {children}
    </div>
  )
}

/** Envoltorio para tablas anchas: scroll horizontal sin romper el layout. */
export function TablaScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200">
      {children}
    </div>
  )
}

export const TH_CLASS =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500"
export const TD_CLASS = "px-4 py-3 align-top text-sm leading-6 text-zinc-700"
