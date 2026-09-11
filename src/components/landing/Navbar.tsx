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
import { useDemoHub } from "@/context/DemoHubContext"

const NAV_ITEMS = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Centro de Ayuda", href: "#conocimiento" },
  { label: "Precios", href: "#precios" },
] as const

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { openDemoHub } = useDemoHub()

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
          <button
            type="button"
            onClick={openDemoHub}
            aria-haspopup="dialog"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700"
          >
            <span aria-hidden="true">🧪</span>
            Entornos DEMO
          </button>
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

            <button
              type="button"
              onClick={openDemoHub}
              aria-haspopup="dialog"
              className="mt-1 flex h-12 w-full items-center justify-start gap-2 rounded-xl bg-zinc-900 px-4 text-base font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <span aria-hidden="true">🧪</span>
              Ver Demos de la Plataforma
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
