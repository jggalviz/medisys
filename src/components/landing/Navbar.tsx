"use client"

/**
 * Navbar principal de la landing.
 *
 * Además de la navegación por anclas y del menú móvil, delega las acciones de
 * la derecha en `HeaderAuthActions`, que resuelve la sesión del visitante:
 *  - **Invitado** → "Iniciar sesión", "Crear cuenta gratis" y "Entornos DEMO".
 *  - **Autenticado** → "Ir a mi Escritorio" (destino según el rol) y menú de
 *    usuario con nombre, rol, perfil, configuración y cierre de sesión.
 */
import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { Brand } from "./Brand"
import { HeaderAuthActions } from "./HeaderAuthActions"

const NAV_ITEMS = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Facturación", href: "#facturacion" },
  { label: "Centro de Ayuda", href: "#conocimiento" },
  { label: "Precios", href: "#precios" },
  { label: "FAQ", href: "#faq" },
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

        {/* Acciones de sesión (desktop/tablet): invitado o autenticado */}
        <HeaderAuthActions variante="escritorio" />

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

            {/* Acciones de sesión (móvil): invitado o autenticado */}
            <HeaderAuthActions
              variante="movil"
              onNavegar={() => setOpen(false)}
            />

          </nav>
        </div>
      )}
    </header>
  )
}
