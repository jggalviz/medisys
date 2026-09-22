"use client"

/**
 * MEDISYS · Selector de modo de la pantalla de acceso (`/registro`).
 *
 * Cambia entre "Crear cuenta" e "Iniciar sesión" manteniendo la misma página
 * (el modo viaja en `?modo=login`), de modo que el enlace es compartible y
 * funciona incluso sin JavaScript.
 */
import Link from "next/link"

import { cn } from "@/lib/utils"

export type AuthModo = "registro" | "login"

type Tab = { modo: AuthModo; etiqueta: string; href: string }

const TABS: readonly Tab[] = [
  { modo: "registro", etiqueta: "Crear cuenta", href: "/registro" },
  { modo: "login", etiqueta: "Iniciar sesión", href: "/registro?modo=login" },
] as const

export function AuthModeTabs({ modo }: { modo: AuthModo }) {
  return (
    <nav
      aria-label="Crear cuenta o iniciar sesión"
      className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
    >
      {TABS.map((tab) => {
        const activo = tab.modo === modo
        return (
          <Link
            key={tab.modo}
            href={tab.href}
            scroll={false}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
              activo
                ? "bg-white text-[#028090] shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}
