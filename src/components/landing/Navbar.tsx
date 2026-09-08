"use client"

/**
 * Navbar de la landing con accesos directos a las dos demos:
 *  - "Demo Reservas" 🏥 → /[demoSlug]/reservar
 *  - "Demo Escritorio" 🖥️ → /[demoSlug]/admin
 *
 * Desktop: botones diferenciados (outline vs primario con badge).
 * Mobile: menú hamburguesa con ambas opciones e íconos.
 */
import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { Brand } from "./Brand"
import { ADMIN_DEMO_ROUTE, RESERVAR_DEMO_ROUTE } from "@/lib/demo"

const NAV_ITEMS = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
] as const

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link href="/" aria-label="Medisys, inicio" className="shrink-0">
          <Brand />
        </Link>

        {/* Navegación principal (desktop) */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-7 lg:flex"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Acciones demo (desktop/tablet) */}
        <div className="hidden items-center gap-2.5 md:flex">
          <Link
            href={RESERVAR_DEMO_ROUTE}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          >
            <span aria-hidden="true">🏥</span>
            Demo Reservas
          </Link>
          <Link
            href={ADMIN_DEMO_ROUTE}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700"
          >
            <span aria-hidden="true">🖥️</span>
            Demo Escritorio
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Para Clínicas
            </span>
          </Link>
        </div>

        {/* Hamburguesa (mobile) */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="menu-movil-landing"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex size-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Menú móvil */}
      {open && (
        <div
          id="menu-movil-landing"
          className="border-t border-zinc-100 bg-white md:hidden"
        >
          <nav
            aria-label="Navegación móvil"
            className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-4 lg:px-8"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center rounded-xl px-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {item.label}
              </a>
            ))}

            <span className="my-2 border-t border-dashed border-zinc-200" />

            <Link
              href={RESERVAR_DEMO_ROUTE}
              onClick={() => setOpen(false)}
              className="flex h-12 items-center gap-3 rounded-xl border border-zinc-200 px-4 font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              <span className="text-xl" aria-hidden="true">
                🏥
              </span>
              <span className="flex flex-col">
                <span>Demo Reservas</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Agenda una cita como paciente
                </span>
              </span>
            </Link>

            <Link
              href={ADMIN_DEMO_ROUTE}
              onClick={() => setOpen(false)}
              className="mt-1 flex h-12 items-center gap-3 rounded-xl bg-zinc-900 px-4 font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <span className="text-xl" aria-hidden="true">
                🖥️
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  Demo Escritorio
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Para Clínicas
                  </span>
                </span>
                <span className="text-xs font-normal text-zinc-300">
                  Explora el panel de recepción
                </span>
              </span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
